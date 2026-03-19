# Phase 1 Step 5 Evidence

Date: 2026-03-18
Status: Done

## Implemented Scope

- Step 5 IPFS metadata integration implemented in backend works pipeline.
- Hashing success path auto-dispatches IPFS pinning task via Celery.
- `CreativeWork` lifecycle extended with explicit statuses:
  - `IPFS_PINNING_COMPLETE`
  - `IPFS_PINNING_FAILED`
- IPFS fields persisted on `CreativeWork`:
  - `ipfs_metadata_cid`
  - `ipfs_pinned_at`
  - `ipfs_error_message`
- Pinata client abstraction added and used by async task.
- Serializer exposes `ipfs_metadata_cid` as read-only.
- Failure behavior implemented: exhausted pinning retries set `IPFS_PINNING_FAILED` and halt downstream progression.

## Verification Run Log

- `python manage.py migrate --noinput` -> applied `works.0003_step5_ipfs_pinning_fields_and_statuses`
- `python manage.py test apps.works.tests --keepdb --noinput` -> **24/24 pass**
- `python test_third_party_connectivity.py` -> **5/5 pass**
  - Pinata: pass
  - Polygon Amoy RPC: pass
  - Redis: pass
  - PostgreSQL: pass
  - SendGrid: pass

## External Platforms Awareness

Provisioning and env placement runbook is maintained in:

- `docs/external-platforms-setup.md`

Platforms covered there:

- Supabase (PostgreSQL)
- Upstash (Redis)
- Alchemy (Polygon Amoy RPC)
- WalletConnect Cloud
- Pinata
- SendGrid
- MetaMask
- Polygonscan
- Vercel
- Heroku
- GitHub
- Polygon Amoy Faucet

