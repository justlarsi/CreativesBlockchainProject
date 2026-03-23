from __future__ import annotations

from datetime import timedelta
from typing import Any
from urllib.parse import urlparse

from django.conf import settings
from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.works.models import ContentHash, CreativeWork

from .models import InfringementAlert, build_source_fingerprint


def _tokenize_text(value: str) -> set[str]:
    return {token for token in (value or '').lower().replace('_', ' ').split() if token}


def _metadata_overlap_score(work: CreativeWork, candidate: dict[str, Any]) -> float:
    work_tokens = _tokenize_text(work.title) | _tokenize_text(work.description)
    source_tokens = _tokenize_text(str(candidate.get('title', ''))) | _tokenize_text(str(candidate.get('description', '')))

    if not work_tokens or not source_tokens:
        return 0.0

    overlap = work_tokens & source_tokens
    return len(overlap) / max(len(work_tokens), 1)


def _advanced_modalities_score(_work: CreativeWork, _candidate: dict[str, Any]) -> float:
    # Step 10 scaffolding: advanced modality implementations are feature-gated placeholders.
    if settings.INFRINGEMENT_ENABLE_IMAGE_PHASH:
        pass
    if settings.INFRINGEMENT_ENABLE_AUDIO_MFCC:
        pass
    if settings.INFRINGEMENT_ENABLE_TEXT_SEMANTIC:
        pass
    return 0.0


def _severity_for_score(score: float) -> str:
    if score >= settings.INFRINGEMENT_SEVERITY_CRITICAL_THRESHOLD:
        return InfringementAlert.Severity.CRITICAL
    if score >= settings.INFRINGEMENT_SEVERITY_HIGH_THRESHOLD:
        return InfringementAlert.Severity.HIGH
    if score >= settings.INFRINGEMENT_SEVERITY_MEDIUM_THRESHOLD:
        return InfringementAlert.Severity.MEDIUM
    return InfringementAlert.Severity.LOW


def _source_platform(source_url: str, fallback: str = '') -> str:
    if fallback:
        return fallback
    host = urlparse(source_url).hostname or ''
    return host.lower()


def _work_hash_values(work: CreativeWork) -> set[str]:
    return {
        item.hash_value.lower()
        for item in work.content_hashes.all()
        if item.hash_type in {
            ContentHash.HashType.SHA256,
            ContentHash.HashType.PERCEPTUAL_AVG,
            ContentHash.HashType.TEXT_NORMALIZED,
        }
    }


def _create_or_update_alert(
    *,
    work: CreativeWork,
    source_fingerprint: str,
    source_url: str,
    source_platform: str,
    score: float,
    reason: str,
    evidence: dict[str, Any],
) -> tuple[InfringementAlert, bool]:
    now = timezone.now()
    open_alert = (
        InfringementAlert.objects
        .filter(
            work=work,
            source_fingerprint=source_fingerprint,
            status__in=[InfringementAlert.Status.PENDING, InfringementAlert.Status.CONFIRMED],
        )
        .first()
    )

    if open_alert:
        open_alert.similarity_score = max(open_alert.similarity_score, score)
        open_alert.severity = _severity_for_score(open_alert.similarity_score)
        open_alert.last_detected_at = now
        open_alert.evidence = evidence
        open_alert.detection_reason = reason
        open_alert.save(
            update_fields=[
                'similarity_score',
                'severity',
                'last_detected_at',
                'evidence',
                'detection_reason',
                'updated_at',
            ]
        )
        return open_alert, False

    defaults = {
        'creator': work.owner,
        'source_url': source_url,
        'source_platform': source_platform,
        'similarity_score': score,
        'severity': _severity_for_score(score),
        'status': InfringementAlert.Status.PENDING,
        'evidence': evidence,
        'detection_reason': reason,
        'last_detected_at': now,
    }

    try:
        with transaction.atomic():
            alert = InfringementAlert.objects.create(
                work=work,
                source_fingerprint=source_fingerprint,
                **defaults,
            )
            return alert, True
    except IntegrityError:
        # Concurrent scans can race on the open-alert uniqueness constraint.
        alert = InfringementAlert.objects.get(
            work=work,
            source_fingerprint=source_fingerprint,
            status__in=[InfringementAlert.Status.PENDING, InfringementAlert.Status.CONFIRMED],
        )
        return alert, False


def run_simulated_scan_for_work(work: CreativeWork, candidates: list[dict[str, Any]]) -> dict[str, Any]:
    work_hashes = _work_hash_values(work)
    created_alert_ids: list[int] = []
    matched_count = 0

    for candidate in candidates:
        source_url = str(candidate.get('source_url', '')).strip()
        if not source_url:
            continue

        source_hash = str(candidate.get('source_hash', '')).strip().lower()
        exact_hash_score = 1.0 if source_hash and source_hash in work_hashes else 0.0
        metadata_score = _metadata_overlap_score(work, candidate)
        advanced_score = _advanced_modalities_score(work, candidate)

        score = max(exact_hash_score, metadata_score, advanced_score)
        if score < settings.INFRINGEMENT_MATCH_THRESHOLD:
            continue

        matched_count += 1
        reason = 'exact_hash_match' if exact_hash_score >= score else 'metadata_overlap'
        source_fingerprint = build_source_fingerprint(
            source_url=source_url,
            source_hash=source_hash,
            title=str(candidate.get('title', '')),
            description=str(candidate.get('description', '')),
        )
        evidence = {
            'source_hash': source_hash,
            'source_title': candidate.get('title', ''),
            'source_description': candidate.get('description', ''),
            'scores': {
                'exact_hash': exact_hash_score,
                'metadata_overlap': metadata_score,
                'advanced_modalities': advanced_score,
                'final': score,
            },
        }

        alert, created = _create_or_update_alert(
            work=work,
            source_fingerprint=source_fingerprint,
            source_url=source_url,
            source_platform=_source_platform(source_url, str(candidate.get('source_platform', ''))),
            score=score,
            reason=reason,
            evidence=evidence,
        )
        if created:
            created_alert_ids.append(alert.id)

    return {
        'work_id': work.id,
        'scanned_candidates': len(candidates),
        'matched_candidates': matched_count,
        'created_alert_ids': created_alert_ids,
    }


def default_daily_candidates_for_work(work: CreativeWork) -> list[dict[str, Any]]:
    # Simulated source set only; Step 10 explicitly excludes live crawling.
    return [
        {
            'source_url': f'https://mock-platform.example/works/{work.id}',
            'source_platform': 'mock-platform.example',
            'title': work.title,
            'description': work.description,
        },
        {
            'source_url': f'https://social.example/post/{work.id}',
            'source_platform': 'social.example',
            'title': work.title,
            'description': f'{work.description} remix',
        },
    ]


def recently_notified(alert: InfringementAlert) -> bool:
    cooldown = timedelta(minutes=settings.INFRINGEMENT_NOTIFICATION_COOLDOWN_MINUTES)
    return timezone.now() - alert.created_at < cooldown

