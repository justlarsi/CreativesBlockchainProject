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
- **Build Tool**: Vite 4+
- **Routing**: React Router v6
- **Styling**: TailwindCSS 3+
- **Blockchain**: Web3.js 4+ for MetaMask integration
- **HTTP Client**: Axios
- **Forms**: React Hook Form

### Backend
- **Framework**: Django 4.2 LTS
- **API Framework**: Django REST Framework 3.14+
- **Database**: PostgreSQL 14+
- **Cache/Queue**: Redis 7+ (Celery message broker)
- **Task Queue**: Celery 5+ for async processing
- **Blockchain**: Web3.py 6+

### Blockchain
- **Network**: Polygon Mumbai Testnet (Phase 1)
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
- Redis 7+ (required for Celery task queue)
- Docker and Docker Compose (recommended for local Postgres/Redis)

### Quick Start (Step 0: Foundation Lock)

1. **Clone and bootstrap**
   ```bash
   git clone <repository-url>
   cd creativechain
   ```

2. **Start PostgreSQL and Redis (Docker)**
   ```bash
   docker-compose up -d
   # This starts:
   # - postgres:14 on localhost:5432
   # - redis:7 on localhost:6379
   ```

3. **Set up Backend**
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # Linux/Mac or venv\Scripts\activate (Windows)
   pip install -r requirements.txt
   cp .env.example .env
   # Edit .env with actual values:
   #   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/creativechain_dev
   #   REDIS_URL=redis://localhost:6379/0
   #   POLYGON_AMOY_RPC_URL=https://polygon-amoy.g.alchemy.com/v2/<YOUR_KEY>
   #   CORS_ALLOWED_ORIGINS=http://localhost:8080,http://localhost:3000
   python manage.py migrate
   python manage.py runserver  # Server on http://localhost:8000
   ```

4. **Verify Backend Health**
   ```bash
   curl http://localhost:8000/health
   # Should return 200 with healthy status for database, redis, blockchain
   ```

5. **Set up Frontend (separate terminal)**
   ```bash
   cd frontend
   npm install  # or bun install
   cp .env.example .env.local
   # Edit .env.local:
   #   VITE_API_BASE_URL=http://localhost:8000
   #   VITE_CHAIN_ID=80002
   #   VITE_RPC_URL=https://polygon-amoy.g.alchemy.com/v2/<YOUR_KEY>
   npm run dev  # Dev server on http://localhost:8080
   ```

6. **Set up Smart Contracts (separate terminal)**
   ```bash
   cd contracts
   npm install
   cp .env.example .env
   # Edit .env:
   #   POLYGON_AMOY_RPC_URL=https://polygon-amoy.g.alchemy.com/v2/<YOUR_KEY>
   npx hardhat compile  # Compile contracts
   npx hardhat test     # Run contract tests
   ```

7. **Start Celery Worker (separate terminal, from backend/)**
   ```bash
   cd backend
   celery -A creativechain worker -l info
   # Worker should connect to Redis and await tasks
   ```

### Post-Setup Verification

All three services should be running:
- Backend: `http://localhost:8000` — health check passes
- Frontend: `http://localhost:8080` — dev server loaded
- Contracts: compile/test pass without errors
- Redis: reachable at `localhost:6379`
- PostgreSQL: connected and migrated

If health check fails at `http://localhost:8000/health`, check:
1. PostgreSQL is running: `docker-compose ps`
2. Redis is running: `docker-compose ps`
3. `POLYGON_AMOY_RPC_URL` is set in `.env`
4. Backend logs for error messages: `python manage.py runserver` output

## Documentation

- [System Memory Artifact](./Docs/blockchain-project.md) - Complete technical documentation
- [Project Specification](./Docs/creativechain-project.json) - Structured project data
- [Implementation Plan](./Docs/IMPLEMENTATION_PLAN.md) - 6-month development roadmap

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
