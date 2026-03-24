# CreativeChain

A decentralized platform that revolutionizes intellectual property protection and licensing for creative professionals using blockchain technology, artificial intelligence, and smart contracts.

## Project Overview

CreativeChain addresses the critical $225-600 billion annual loss to IP theft by combining:
- **Blockchain Timestamping**: Immutable proof of ownership via Polygon blockchain
- **AI-Powered Detection**: Automated similarity detection using perceptual hashing and ML models
- **Direct Licensing Marketplace**: Creator-to-buyer licensing with smart contracts (100% revenue retention)
- **Automated Legal Tools**: DMCA notices and C&D letter generation
- **Transparent Collaboration**: Multi-party revenue splits via smart contracts

## Technology Stack

### Frontend
- **Framework**: React 18.2+ with TypeScript 5+
- **Build Tool**: Vite 5+
- **Routing**: React Router v6
- **Styling**: TailwindCSS 3+
- **Blockchain**: Wagmi + Viem (MetaMask + WalletConnect support)
- **HTTP Client**: Fetch API wrappers in `frontend/src/api/*`
- **Forms**: React Hook Form

### Backend
- **Framework**: Django 4.2 LTS
- **API Framework**: Django REST Framework 3.14+
- **Database**: PostgreSQL 14+
- **Cache/Queue**: Redis 7+ (Celery message broker)
- **Task Queue**: Celery 5+ for async processing
- **Blockchain**: Web3.py 6+

### Blockchain
- **Network**: Polygon Amoy Testnet (chainId 80002)
- **Language**: Solidity 0.8+
- **Development**: Hardhat
- **Node Provider**: Alchemy API
- **Wallet**: MetaMask

## Project Structure

```
creativechain/
├── frontend/          # React application
├── backend/           # Django API
├── contracts/         # Solidity smart contracts
├── docs/              # Documentation
├── scripts/           # Utility scripts
└── docker-compose.yml # Local development setup
```

## Getting Started

**Prerequisites:** Ensure `.env` files are created and fully configured in `backend/`, `frontend/`, and `contracts/` before proceeding. See `backend/.env.example` for required variables.

### Prerequisites

- Node.js 18+
- Python 3.11+
- PostgreSQL 14+ (required; no SQLite fallback in development)
- Redis URL (required for Celery task queue): external (e.g., Upstash) or local Redis 7+
- Docker and Docker Compose (optional; only needed if you run Redis locally)

### 0) Clone the repository

```bash
git clone <repository-url>
cd project
```

### 1) Start Redis (if using local/Docker option)

If your `backend/.env` has `REDIS_URL=redis://localhost:6379/0`, start Redis via Docker:

```bash
docker compose up -d
docker compose ps
```

Expected: `creativechain-redis` is up and healthy on `localhost:6379`.

If using managed Redis (Upstash/external), skip this step.

### 2) Run Backend (Django API)

From `backend/`:

```bash
cd backend

# Create and activate virtual environment
python -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run migrations (assumes DATABASE_URL in .env is set and accessible)
python manage.py migrate

# Start dev server
python manage.py runserver
```

Backend runs at `http://localhost:8000`.

### 3) Run Celery worker (new terminal)

From `backend/` with the venv active:

```bash
cd backend
source .venv/bin/activate

# Start the Celery worker (REDIS_URL from .env is used automatically)
celery -A creativechain worker -l info
```

To verify Celery is working, in another terminal:

```bash
cd backend
source .venv/bin/activate
python manage.py verify_celery
```

The worker must be running first, otherwise `verify_celery` will time out.

### 4) Run Frontend (new terminal)

From `frontend/`:

```bash
cd frontend

# Install dependencies
npm install

# Start dev server (uses VITE_* vars from .env.local)
npm run dev
```

Frontend runs at `http://localhost:8080`.

### 5) Run Contracts (new terminal)

From `contracts/`:

```bash
cd contracts

# Install dependencies
npm install

# Compile contracts (uses POLYGON_AMOY_RPC_URL from .env)
npm run compile

# Run tests
npm run test
```

Optional contract quality checks:

```bash
npm run coverage
npm run analyze
npm run export:abis
```

If `slither` is not globally available, use the backend venv-provided binary:

```bash
/home/darkduty/project/backend/.venv/bin/slither . --config-file slither.config.json
```

## Quick Health Verification

Run these after all services are up:

```bash
curl http://localhost:8000/health
curl http://localhost:8000/api/v1/health/
```

Expected:
- Backend health endpoints return success for DB + Redis + blockchain checks.
- Frontend loads at `http://localhost:8080`.
- Celery worker shows connected-to-Redis startup logs.

## Running Tests

### Backend

> Supabase note: always use `--keepdb --noinput` to avoid teardown failures from active sessions.

```bash
cd backend
source .venv/bin/activate

python manage.py test --keepdb --noinput
```

Targeted backend tests example:

```bash
python manage.py test apps.marketplace.tests --keepdb --noinput
```

### Frontend

```bash
cd frontend
npm run test
```

### Contracts

```bash
cd contracts
npm run test
```

## Step 15 Deployment Smoke Runbook

### Backend deployment essentials (Heroku)

- Ensure `backend/Procfile` includes a `release` process for safe migrations.
- Ensure `backend/runtime.txt` matches your target Python runtime.
- Ensure `backend/requirements.txt` includes `gunicorn`.

Deploy backend subtree and check release output:

```bash
cd /home/darkduty/project/backend
heroku releases:output -a <your-heroku-app>
```

### Frontend deployment essentials (Vercel)

- Set project root to `frontend/` in Vercel.
- Configure required `VITE_*` environment variables.

### Monitoring baseline (Step 15)

- External uptime provider: Better Stack
- Error tracking: Sentry (`SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `SENTRY_TRACES_SAMPLE_RATE` in backend env)
- Alert destination: Discord webhook (wired from Better Stack + Sentry)

### Extended smoke checks (post-deploy)

Use `scripts/step15-smoke.sh` against deployed URLs.

Required env vars:
- `API_BASE_URL`
- `SMOKE_TEST_EMAIL`
- `SMOKE_TEST_PASSWORD`
- `SMOKE_TEST_USERNAME`
- `SMOKE_TEST_MARKETPLACE_WORK_ID`
- `SMOKE_TEST_LICENSING_WORK_ID`
- `SMOKE_TEST_INFRINGEMENT_WORK_ID`
- `SMOKE_TEST_LEGAL_WORK_ID`
- Optional: `SMOKE_TEST_COLLABORATION_ID`, `SMOKE_TEST_LICENSING_TX_HASH`

Run:

```bash
cd /home/darkduty/project
./scripts/step15-smoke.sh
```

## Common Issues

1. Backend health fails with DB error:
   - Confirm `DATABASE_URL` points to PostgreSQL and includes `sslmode=require`.
   - URL-encode DB password characters in the connection string.
2. Celery does not start:
   - Confirm `REDIS_URL` is correct and reachable.
   - If using local Redis, verify `docker compose ps` shows `creativechain-redis` healthy.
   - If using Upstash/managed Redis, use `rediss://...` and include required TLS query params from your provider.
3. Frontend cannot reach API:
   - Confirm `VITE_API_BASE_URL=http://localhost:8000` in `frontend/.env.local`.
4. WalletConnect button missing:
   - Set `VITE_WALLETCONNECT_PROJECT_ID` in `frontend/.env.local`.
5. Contract deploy/verify fails:
   - Ensure `PRIVATE_KEY`, `POLYGON_AMOY_RPC_URL`, and `POLYGONSCAN_API_KEY` are set in `contracts/.env`.

## Documentation

- [AI docs index](./AI_DOCS/README.md)
- [Product requirements](./AI_DOCS/1_PRD.md)
- [Architecture](./AI_DOCS/2_ARCHITECTURE.md)
- [Execution plan](./AI_DOCS/4_PLAN.md)

## Development Status

**Phase 1: Foundation (Months 1-6)** - Complete ✅

- ✅ Step 0: Project structure setup
- ✅ Step 1: User registration and authentication
- ✅ Step 2: Wallet integration and chain gatekeeping
- ✅ Step 3: Content upload and validation
- ✅ Step 4: Async hashing (Celery)
- ✅ Step 5: IPFS metadata pinning
- ✅ Step 6: Smart contract deployment
- ✅ Step 7: Blockchain registration
- ✅ Step 8: Marketplace browse/detail
- ✅ Step 9: Licensing purchase flow
- ✅ Step 10: Infringement detection and alerts
- ✅ Step 11: Legal document generation
- ✅ Step 12: Collaboration + revenue split
- ✅ Step 13: Analytics dashboard
- ✅ Step 14: Security hardening (CI/CD + throttling)
- ✅ Step 15: Deployment & Beta Readiness

**Next Phase:** Live deployment (50+ beta testers)

## License

[To be determined]

## Contact

[To be added]
