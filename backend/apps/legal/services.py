import io
from datetime import datetime

from django.core.files.base import ContentFile

from apps.infringement.models import InfringementAlert
from apps.works.models import CreativeWork

from .models import LegalDocument


def _escape_pdf_text(value: str) -> str:
    return value.replace('\\', '\\\\').replace('(', '\\(').replace(')', '\\)')


def _minimal_pdf_bytes(lines: list[str]) -> bytes:
    stream_lines = ['BT', '/F1 11 Tf', '50 790 Td']
    for line in lines[:40]:
        stream_lines.append(f'({_escape_pdf_text(line[:180])}) Tj')
        stream_lines.append('T*')
    stream_lines.append('ET')
    stream = '\n'.join(stream_lines).encode('utf-8')

    objects = [
        b'1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
        b'2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
        b'3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n',
        f'4 0 obj\n<< /Length {len(stream)} >>\nstream\n'.encode('utf-8') + stream + b'\nendstream\nendobj\n',
        b'5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
    ]

    output = io.BytesIO()
    output.write(b'%PDF-1.4\n')

    offsets = [0]
    for obj in objects:
        offsets.append(output.tell())
        output.write(obj)

    xref_start = output.tell()
    output.write(f'xref\n0 {len(objects) + 1}\n'.encode('utf-8'))
    output.write(b'0000000000 65535 f \n')
    for offset in offsets[1:]:
        output.write(f'{offset:010d} 00000 n \n'.encode('utf-8'))

    output.write(
        (
            f'trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\n'
            f'startxref\n{xref_start}\n%%EOF\n'
        ).encode('utf-8')
    )
    return output.getvalue()


def _build_document_lines(*, document_type: str, creator_name: str, creator_email: str, work: CreativeWork, alert: InfringementAlert | None) -> list[str]:
    now_utc = datetime.utcnow().replace(microsecond=0).isoformat() + 'Z'
    title = 'DMCA Takedown Notice' if document_type == LegalDocument.DocumentType.DMCA else 'Cease and Desist Letter'

    lines = [
        'CreativeChain Legal Document',
        title,
        '',
        f'Generated At (UTC): {now_utc}',
        f'Creator: {creator_name}',
        f'Creator Email: {creator_email}',
        '',
        f'Work ID: {work.id}',
        f'Work Title: {work.title}',
        f'Work Category: {work.category}',
        f'Work Status: {work.status}',
        f'Work Description: {work.description or ""}',
        '',
        'Blockchain Proof',
        f'Blockchain Tx Hash: {work.blockchain_tx_hash or ""}',
        f'Block Number: {work.blockchain_block_number if work.blockchain_block_number is not None else ""}',
        (
            f'Registration Timestamp: {work.blockchain_registration_timestamp.isoformat()}'
            if work.blockchain_registration_timestamp
            else 'Registration Timestamp: '
        ),
        f'IPFS Metadata CID: {work.ipfs_metadata_cid or ""}',
    ]

    content_hashes = list(work.content_hashes.order_by('hash_type').values_list('hash_type', 'hash_value'))
    lines.append('')
    lines.append('Content Hashes')
    if content_hashes:
        for hash_type, hash_value in content_hashes:
            lines.append(f'- {hash_type}: {hash_value}')
    else:
        lines.append('- None available')

    if alert is not None:
        lines.extend(
            [
                '',
                'Alert Context',
                f'Alert ID: {alert.id}',
                f'Alert Status: {alert.status}',
                f'Source URL: {alert.source_url}',
                f'Similarity Score: {alert.similarity_score}',
                f'Severity: {alert.severity}',
            ]
        )

    return lines


def build_proof_snapshot(*, work: CreativeWork, alert: InfringementAlert | None) -> dict:
    snapshot = {
        'work': {
            'id': work.id,
            'title': work.title,
            'category': work.category,
            'status': work.status,
            'ipfs_metadata_cid': work.ipfs_metadata_cid,
            'blockchain_tx_hash': work.blockchain_tx_hash,
            'blockchain_block_number': work.blockchain_block_number,
            'blockchain_registration_timestamp': work.blockchain_registration_timestamp.isoformat() if work.blockchain_registration_timestamp else None,
            'content_hashes': [
                {'hash_type': hash_type, 'hash_value': hash_value}
                for hash_type, hash_value in work.content_hashes.order_by('hash_type').values_list('hash_type', 'hash_value')
            ],
        },
        'alert': None,
    }
    if alert is not None:
        snapshot['alert'] = {
            'id': alert.id,
            'status': alert.status,
            'source_url': alert.source_url,
            'similarity_score': alert.similarity_score,
            'severity': alert.severity,
        }
    return snapshot


def generate_legal_document(*, creator, work: CreativeWork, alert: InfringementAlert | None, document_type: str) -> LegalDocument:
    lines = _build_document_lines(
        document_type=document_type,
        creator_name=creator.get_full_name() or creator.username,
        creator_email=creator.email,
        work=work,
        alert=alert,
    )
    content = _minimal_pdf_bytes(lines)

    document = LegalDocument.objects.create(
        creator=creator,
        work=work,
        alert=alert,
        document_type=document_type,
        proof_snapshot=build_proof_snapshot(work=work, alert=alert),
    )
    suffix = 'dmca' if document_type == LegalDocument.DocumentType.DMCA else 'cease-desist'
    filename = f'legal-{suffix}-{document.id}.pdf'
    document.file.save(filename, ContentFile(content), save=True)
    return document

