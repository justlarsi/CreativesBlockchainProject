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
- PostgreSQL 14+
- Redis 7+
- Docker (optional, for containerized development)

### Development Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd creativechain
   ```

2. **Set up Backend**
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # Linux/Mac
   # venv\Scripts\activate  # Windows
   pip install -r requirements.txt
   cp .env.example .env
   # Edit .env with your configuration
   python manage.py migrate
   python manage.py runserver
   ```

3. **Set up Frontend**
   ```bash
   cd frontend
   npm install
   cp .env.example .env.local
   # Edit .env.local with your configuration
   npm run dev
   ```

4. **Set up Smart Contracts**
   ```bash
   cd contracts
   npm install
   cp .env.example .env
   # Edit .env with your Alchemy API key
   npx hardhat compile
   ```

5. **Set up Docker (Optional)**
   ```bash
   docker-compose up -d
   ```

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
