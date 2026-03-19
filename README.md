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

### 1) Redis setup (choose one)

#### Option A: Use external Redis (recommended if already provisioned)

Set `REDIS_URL` in `backend/.env` to your managed Redis URL.

- Upstash example (TLS): `rediss://...`
- Local Redis example: `redis://localhost:6379/0`

#### Option B: Run local Redis via Docker (optional)

```bash
docker compose up -d
docker compose ps
```

Expected: `creativechain-redis` is up and healthy on `localhost:6379`.

### 2) Configure and run Backend (Django API)

From `backend/`:

```bash
cd backend

# Use the canonical local environment path for this project.
python -m venv .venv
source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
```

Edit `backend/.env` and set at minimum:

- `SECRET_KEY`
- `DEBUG=True`
- `ALLOWED_HOSTS=localhost,127.0.0.1`
- `DATABASE_URL=postgresql://<SUPABASE_DB_USER>:<SUPABASE_DB_PASSWORD_URLENCODED>@<SUPABASE_DB_HOST>:5432/<SUPABASE_DB_NAME>?sslmode=require`
- `REDIS_URL=<YOUR_REDIS_URL>` (use `rediss://...` for managed TLS Redis, or `redis://localhost:6379/0` for local)
- `POLYGON_AMOY_RPC_URL=https://polygon-amoy.g.alchemy.com/v2/<YOUR_KEY>`
- `CORS_ALLOWED_ORIGINS=http://localhost:8080`

Then run migrations and API server:

```bash
python manage.py migrate
python manage.py runserver
```

Backend runs at `http://localhost:8000`.

### 3) Run Celery worker (new terminal)

From `backend/` with the same venv active:

```bash
cd backend
source .venv/bin/activate

celery -A creativechain worker -l info
```

Then, in a separate terminal (while the worker is still running), run:

```bash
cd backend
source .venv/bin/activate
python manage.py verify_celery
```

If the worker is not running first, `verify_celery` will time out.

### 4) Configure and run Frontend (new terminal)

From `frontend/`:

```bash
cd frontend
npm install
```

Create `frontend/.env.local` with:

```bash
cat > .env.local << 'EOF'
VITE_API_BASE_URL=http://localhost:8000
VITE_CHAIN_ID=80002
VITE_RPC_URL=https://polygon-amoy.g.alchemy.com/v2/<YOUR_KEY>
# Optional: enables WalletConnect button when set
# VITE_WALLETCONNECT_PROJECT_ID=<YOUR_PROJECT_ID>
EOF
```

Run the dev server:

```bash
npm run dev
```

Frontend runs at `http://localhost:8080`.

### 5) Configure and run Contracts workspace (new terminal)

From `contracts/`:

```bash
cd contracts
npm install
```

Create `contracts/.env` with local/test values:

```bash
cat > .env << 'EOF'
POLYGON_AMOY_RPC_URL=https://polygon-amoy.g.alchemy.com/v2/<YOUR_KEY>
# Required only for deploy/verify
# PRIVATE_KEY=<0x...>
# POLYGONSCAN_API_KEY=<YOUR_KEY>
EOF
```

Compile and test contracts:

```bash
npm run compile
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
cd /home/darkduty/project/contracts
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

**Phase 1: Foundation (Months 1-6)** - Current Academic Project
- ✅ Project structure setup
- ⏳ User registration and authentication
- ⏳ Content upload and blockchain registration
- ⏳ AI similarity detection
- ⏳ Licensing marketplace
- ⏳ Legal document generation
- ⏳ Analytics dashboard
- ⏳ Collaboration management

## License

[To be determined]

## Contact

[To be added]
