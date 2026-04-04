from __future__ import annotations

import re
from html import unescape
from datetime import timedelta
from typing import Any
from urllib.parse import parse_qs, quote_plus, unquote, urlparse

import requests

from django.conf import settings
from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.works.models import ContentHash, CreativeWork

from .models import InfringementAlert, build_source_fingerprint


_DDG_RESULT_LINK_RE = re.compile(
    r'<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>(.*?)</a>',
    re.IGNORECASE | re.DOTALL,
)
_DDG_RESULT_SNIPPET_RE = re.compile(
    r'<a[^>]*class="result__snippet"[^>]*>(.*?)</a>|<div[^>]*class="result__snippet"[^>]*>(.*?)</div>',
    re.IGNORECASE | re.DOTALL,
)


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


def _clean_html_text(raw: str) -> str:
    no_tags = re.sub(r'<[^>]+>', ' ', raw or '')
    collapsed = re.sub(r'\s+', ' ', no_tags)
    return unescape(collapsed).strip()


def _extract_ddg_target_url(href: str) -> str:
    href = unescape(href or '').strip()
    if href.startswith('/l/?'):
        query = parse_qs(urlparse(href).query)
        encoded_target = query.get('uddg', [''])[0]
        return unquote(encoded_target) if encoded_target else ''
    return href


def _safe_platform(value: str) -> str:
    host = (value or '').strip().lower()
    if not host:
        return ''
    if host.startswith('http://') or host.startswith('https://'):
        return (urlparse(host).hostname or '').lower()
    return host


def _default_platforms() -> list[str]:
    return [
        'instagram.com',
        'tiktok.com',
        'pinterest.com',
        'youtube.com',
        'reddit.com',
        'facebook.com',
        'x.com',
    ]


def _discover_ddg_results(query: str, max_results: int) -> list[dict[str, str]]:
    response = requests.get(
        f'https://duckduckgo.com/html/?q={quote_plus(query)}',
        timeout=settings.INFRINGEMENT_PUBLIC_SCAN_TIMEOUT_SEC,
        headers={'User-Agent': 'CreativeChainBot/1.0 (+https://creativechain.local)'},
    )
    response.raise_for_status()

    snippets = _DDG_RESULT_SNIPPET_RE.findall(response.text)
    snippet_values = [_clean_html_text(item[0] or item[1]) for item in snippets]

    results: list[dict[str, str]] = []
    for index, (href, title_html) in enumerate(_DDG_RESULT_LINK_RE.findall(response.text)):
        source_url = _extract_ddg_target_url(href)
        if not source_url.startswith('http://') and not source_url.startswith('https://'):
            continue

        parsed = urlparse(source_url)
        if not parsed.hostname:
            continue

        results.append(
            {
                'source_url': source_url,
                'source_platform': parsed.hostname.lower(),
                'title': _clean_html_text(title_html),
                'description': snippet_values[index] if index < len(snippet_values) else '',
            }
        )
        if len(results) >= max_results:
            break

    return results


def discover_public_candidates_for_work(
    work: CreativeWork,
    *,
    platforms: list[str] | None = None,
    max_results: int | None = None,
) -> tuple[list[dict[str, str]], list[str]]:
    final_platforms = [p for p in (_safe_platform(item) for item in (platforms or [])) if p]
    if not final_platforms:
        final_platforms = _default_platforms()

    max_items = max_results or settings.INFRINGEMENT_PUBLIC_SCAN_MAX_RESULTS
    max_items = max(1, min(max_items, 50))

    query_base = ' '.join(part for part in [work.title.strip(), work.description.strip()] if part).strip()
    if not query_base:
        query_base = f'work {work.id}'

    dedup: dict[str, dict[str, str]] = {}
    for platform in final_platforms:
        query = f'"{work.title}" {work.description} site:{platform}'.strip()
        try:
            for result in _discover_ddg_results(query or query_base, max_items):
                dedup.setdefault(result['source_url'], result)
        except requests.RequestException:
            continue

        if len(dedup) >= max_items:
            break

    return list(dedup.values())[:max_items], final_platforms

