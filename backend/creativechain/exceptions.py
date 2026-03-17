from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler


def _extract_message(data) -> str:
    if isinstance(data, dict):
        if 'detail' in data and isinstance(data['detail'], str):
            return data['detail']
        for value in data.values():
            if isinstance(value, list) and value:
                return str(value[0])
            if isinstance(value, str):
                return value
    if isinstance(data, list) and data:
        return str(data[0])
    if isinstance(data, str):
        return data
    return 'Request failed.'


def creativechain_exception_handler(exc, context):
    response = exception_handler(exc, context)

    if response is None:
        return Response(
            {
                'error': {
                    'code': 'server_error',
                    'message': 'Internal server error.',
                    'details': {},
                }
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    details = response.data
    payload = {
        'error': {
            'code': f'http_{response.status_code}',
            'message': _extract_message(details),
            'details': details,
        }
    }

    if isinstance(details, dict):
        payload.update(details)
    elif isinstance(details, list):
        payload['detail'] = _extract_message(details)
    elif isinstance(details, str):
        payload['detail'] = details

    response.data = payload
    return response

