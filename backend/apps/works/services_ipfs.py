# IPFS helpers for works app.

import json
from urllib import error, request

from django.conf import settings

PINATA_PIN_JSON_URL = 'https://api.pinata.cloud/pinning/pinJSONToIPFS'


class PinataPinError(Exception):
    """Raised when pinning metadata to Pinata fails."""


class PinataClient:
    def __init__(self, api_key: str, secret_key: str, timeout_seconds: int = 15):
        self.api_key = api_key
        self.secret_key = secret_key
        self.timeout_seconds = timeout_seconds

    def pin_json(self, payload: dict, metadata_name: str) -> str:
        if not self.api_key or not self.secret_key:
            raise PinataPinError('Pinata credentials are not configured.')

        request_body = {
            'pinataOptions': {'cidVersion': 1},
            'pinataMetadata': {'name': metadata_name},
            'pinataContent': payload,
        }

        req = request.Request(
            PINATA_PIN_JSON_URL,
            data=json.dumps(request_body).encode('utf-8'),
            method='POST',
            headers={
                'Content-Type': 'application/json',
                'pinata_api_key': self.api_key,
                'pinata_secret_api_key': self.secret_key,
            },
        )

        try:
            with request.urlopen(req, timeout=self.timeout_seconds) as response:
                response_payload = response.read().decode('utf-8')
        except error.HTTPError as exc:
            detail = exc.read().decode('utf-8', errors='replace')
            raise PinataPinError(f'Pinata HTTP error {exc.code}: {detail}') from exc
        except error.URLError as exc:
            raise PinataPinError(f'Pinata connection error: {exc.reason}') from exc
        except Exception as exc:
            raise PinataPinError(f'Unexpected Pinata error: {exc}') from exc

        try:
            decoded = json.loads(response_payload)
        except json.JSONDecodeError as exc:
            raise PinataPinError('Pinata returned invalid JSON response.') from exc

        cid = decoded.get('IpfsHash')
        if not cid:
            raise PinataPinError('Pinata response missing IpfsHash.')

        return cid


def get_pinata_client() -> PinataClient:
    return PinataClient(
        api_key=settings.PINATA_API_KEY,
        secret_key=settings.PINATA_SECRET_KEY,
    )
