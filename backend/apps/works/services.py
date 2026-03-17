import os
import uuid
import zipfile
from io import BytesIO

from django.utils.text import get_valid_filename
from rest_framework import exceptions

from .models import CreativeWork

MAX_UPLOAD_BYTES = 500 * 1024 * 1024

ALLOWED_MIME_BY_CATEGORY = {
    CreativeWork.Category.IMAGE: {
        'image/png',
        'image/jpeg',
        'image/webp',
        'image/gif',
    },
    CreativeWork.Category.AUDIO: {
        'audio/mpeg',
        'audio/wav',
        'audio/x-wav',
        'audio/ogg',
        'audio/flac',
        'audio/mp4',
    },
    CreativeWork.Category.VIDEO: {
        'video/mp4',
        'video/webm',
        'video/quicktime',
        'video/x-msvideo',
        'video/x-matroska',
    },
    CreativeWork.Category.TEXT: {
        'text/plain',
        'text/markdown',
        'text/csv',
    },
    CreativeWork.Category.DOCUMENT: {
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    },
}


def sanitize_filename(filename: str) -> str:
    safe_name = get_valid_filename(os.path.basename(filename or ''))
    if safe_name:
        return safe_name
    return f'upload-{uuid.uuid4().hex}.bin'


def _looks_like_text(raw: bytes) -> bool:
    if not raw:
        return False
    try:
        decoded = raw.decode('utf-8')
    except UnicodeDecodeError:
        return False

    if not decoded.strip():
        return True

    printable = sum(ch.isprintable() or ch in '\n\r\t' for ch in decoded)
    return (printable / max(len(decoded), 1)) > 0.9


def _is_docx(raw: bytes, uploaded_file) -> bool:
    if not raw.startswith(b'PK'):
        return False

    position = uploaded_file.tell()
    uploaded_file.seek(0)
    try:
        with zipfile.ZipFile(BytesIO(uploaded_file.read())) as archive:
            names = set(archive.namelist())
            return '[Content_Types].xml' in names and 'word/document.xml' in names
    except zipfile.BadZipFile:
        return False
    finally:
        uploaded_file.seek(position)


def detect_mime_type(uploaded_file) -> str:
    position = uploaded_file.tell()
    uploaded_file.seek(0)
    raw = uploaded_file.read(8192)
    uploaded_file.seek(position)

    if raw.startswith(b'\x89PNG\r\n\x1a\n'):
        return 'image/png'
    if raw.startswith(b'\xff\xd8\xff'):
        return 'image/jpeg'
    if raw.startswith(b'GIF87a') or raw.startswith(b'GIF89a'):
        return 'image/gif'
    if raw.startswith(b'RIFF') and raw[8:12] == b'WEBP':
        return 'image/webp'

    if raw.startswith(b'ID3') or (len(raw) > 2 and raw[0:2] == b'\xff\xfb'):
        return 'audio/mpeg'
    if raw.startswith(b'RIFF') and raw[8:12] == b'WAVE':
        return 'audio/wav'
    if raw.startswith(b'OggS'):
        return 'audio/ogg'
    if raw.startswith(b'fLaC'):
        return 'audio/flac'

    if len(raw) > 12 and raw[4:8] == b'ftyp':
        major_brand = raw[8:12]
        if major_brand in {b'isom', b'mp41', b'mp42'}:
            return 'video/mp4'
        if major_brand in {b'M4A ', b'M4B ', b'M4P '}:
            return 'audio/mp4'
        if major_brand in {b'qt  '}:
            return 'video/quicktime'
    if raw.startswith(b'\x1a\x45\xdf\xa3'):
        return 'video/x-matroska'
    if raw.startswith(b'RIFF') and raw[8:12] == b'AVI ':
        return 'video/x-msvideo'

    if raw.startswith(b'%PDF-'):
        return 'application/pdf'
    if raw.startswith(b'\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1'):
        return 'application/msword'
    if _is_docx(raw, uploaded_file):
        return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

    if _looks_like_text(raw):
        return 'text/plain'

    return 'application/octet-stream'


def validate_upload_or_raise(work: CreativeWork, uploaded_file) -> tuple[str, str]:
    if uploaded_file.size > MAX_UPLOAD_BYTES:
        raise exceptions.ValidationError({'file': ['File exceeds 500 MB limit.']})

    sanitized_name = sanitize_filename(uploaded_file.name)
    mime_type = detect_mime_type(uploaded_file)
    allowed_for_category = ALLOWED_MIME_BY_CATEGORY.get(work.category, set())

    if mime_type not in allowed_for_category:
        raise exceptions.ValidationError(
            {
                'file': [
                    f'Unsupported MIME type {mime_type!r} for category {work.category!r}.',
                ]
            }
        )

    return sanitized_name, mime_type

