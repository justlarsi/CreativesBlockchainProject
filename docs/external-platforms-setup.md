# External Platforms Setup Guide — CreativeChain

> **Purpose**: Every external service CreativeChain depends on, where to sign up, exactly what to collect, and precisely which file each credential goes into.
> Read this top-to-bottom before running any part of the system.
>
> **Canonical status note**: Step completion state is tracked in `AI_DOCS/4_PLAN.md`. This file is an operational provisioning guide.

---

## Quick-Reference Map (what goes where)

| Credential / Value | File |
|--------------------|------|
| `DATABASE_URL` | `backend/.env` |
| `REDIS_URL` | `backend/.env` |
| `SECRET_KEY` | `backend/.env` |
| `POLYGON_AMOY_RPC_URL` | `backend/.env` + `contracts/.env` |
| `PINATA_API_KEY` / `PINATA_SECRET_KEY` | `backend/.env` |
| `SENDGRID_API_KEY` / `EMAIL_FROM` | `backend/.env` |
| `CORS_ALLOWED_ORIGINS` | `backend/.env` |
| `PRIVATE_KEY` (deployer wallet) | `contracts/.env` — **NEVER commit** |
| `POLYGONSCAN_API_KEY` | `contracts/.env` |
| `VITE_API_BASE_URL` | `frontend/.env` |
| `VITE_RPC_URL` | `frontend/.env` |
| `VITE_WALLETCONNECT_PROJECT_ID` | `frontend/.env` |
| `VITE_CONTRACT_*_ADDRESS` | `frontend/.env` (filled after Step 6 deployment) |

---

## 1. Supabase — PostgreSQL Database

**URL**: https://supabase.com
**Plan**: Free (500 MB, unlimited API calls)
**Why**: Managed PostgreSQL 15 with `sslmode=require` already enforced.

### Steps
1. Go to https://supabase.com → **Start your project** → sign in with GitHub.
2. Click **New project** → choose a region close to Nairobi (e.g. **Europe West** or **US East**) → set a strong database password → **Create new project**.
3. Wait ~2 min for provisioning.
4. In your project dashboard: **Project Settings** → **Database** → scroll to **Connection string** → select **URI** tab.
5. Copy the URI. It looks like:
   ```
   postgresql://postgres.[ref]:[password]@aws-0-eu-west-2.pooler.supabase.com:6543/postgres
   ```
6. Append `?sslmode=require` if not already present.

### Where it goes
```dotenv
# backend/.env
DATABASE_URL=postgresql://postgres.[ref]:[password]@aws-0-eu-west-2.pooler.supabase.com:6543/postgres?sslmode=require
```

> **Note**: URL-encode special characters in the password (e.g. `@` → `%40`, `#` → `%23`).

---

## 2. Upstash — Redis (Celery Broker + Cache)

**URL**: https://upstash.com
**Plan**: Free (10,000 commands/day, 256 MB)
**Why**: Serverless Redis with a TLS connection URL — works on any deployment platform.

### Steps
1. Go to https://upstash.com → **Sign up** (GitHub login available).
2. Click **Create Database** → name it `creativechain-redis` → select **Global** replication → click **Create**.
3. On the database page scroll to **REST API** or **Redis Connection** → copy the **Redis URL** (the `rediss://...` TLS variant).

### Where it goes
```dotenv
# backend/.env
REDIS_URL=rediss://default:[password]@[host].upstash.io:6379
```

---

## 3. Alchemy — Polygon Amoy RPC

**URL**: https://www.alchemy.com
**Plan**: Free (300M compute units/month)
**Why**: Reliable RPC endpoint for Polygon Amoy testnet; used by both backend blockchain checks and the frontend wallet.

### Steps
1. Go to https://www.alchemy.com → **Get started free** → create an account.
2. Click **+ Create new app** → **Chain**: Polygon → **Network**: Polygon Amoy → name it `creativechain-amoy` → **Create app**.
3. On the app page click **API key** → copy the **HTTPS URL** (looks like `https://polygon-amoy.g.alchemy.com/v2/YOUR_KEY`).

### Where it goes
```dotenv
# backend/.env
POLYGON_AMOY_RPC_URL=https://polygon-amoy.g.alchemy.com/v2/YOUR_KEY

# contracts/.env
POLYGON_AMOY_RPC_URL=https://polygon-amoy.g.alchemy.com/v2/YOUR_KEY

# frontend/.env
VITE_RPC_URL=https://polygon-amoy.g.alchemy.com/v2/YOUR_KEY
```

> **Fallback**: If Alchemy is down, the public endpoint `https://rpc-amoy.polygon.technology` works without a key (no rate-limit SLA).

---

## 4. WalletConnect Cloud — Wallet Connection

**URL**: https://cloud.walletconnect.com
**Plan**: Free (unlimited projects)
**Why**: Required to enable the WalletConnect QR-code fallback connector in Step 2. Without this, only MetaMask injected connector works.

### Steps
1. Go to https://cloud.walletconnect.com → **Sign up** with GitHub or email.
2. Click **Create project** → name it `CreativeChain` → **App type**: Web3Modal → **Create**.
3. On the project page copy the **Project ID** (32-character hex string).

### Where it goes
```dotenv
# frontend/.env
VITE_WALLETCONNECT_PROJECT_ID=YOUR_PROJECT_ID
```

---

## 5. Pinata — IPFS Metadata Storage

**URL**: https://pinata.cloud
**Plan**: Free (1 GB storage, 100 requests/month on free — enough for Phase 1 beta)
**Why**: Used in Step 5 to pin content metadata JSON to IPFS and store the CID with each work.

### Steps
1. Go to https://pinata.cloud → **Sign up** with email.
2. Verify your email.
3. In your dashboard: **API Keys** → **New Key** → tick **pinFileToIPFS** and **pinJSONToIPFS** → name it `creativechain-backend` → **Create Key**.
4. Copy the **API Key** and **API Secret** shown once (not retrievable again — save immediately).

### Where it goes
```dotenv
# backend/.env
PINATA_API_KEY=YOUR_API_KEY
PINATA_SECRET_KEY=YOUR_API_SECRET
```

---

## 6. SendGrid — Transactional Email

**URL**: https://sendgrid.com
**Plan**: Free (100 emails/day forever)
**Why**: Used in Step 10 to send infringement alert notifications to creators.

### Steps
1. Go to https://sendgrid.com → **Start for free** → create an account.
2. Complete email verification. SendGrid may ask you to verify your domain — for development you can skip domain auth and use single-sender verification.
3. **Single Sender Verification**: Settings → **Sender Authentication** → **Verify a Single Sender** → add your `from` email address → verify via the email they send.
4. **Create API Key**: Settings → **API Keys** → **Create API Key** → name it `creativechain` → **Restricted access** → enable **Mail Send** → **Create & View** → copy the key.

### Where it goes
```dotenv
# backend/.env
SENDGRID_API_KEY=SG.YOUR_KEY
EMAIL_FROM=yourverified@email.com
```

---

## 7. MetaMask — Wallet for Development and Testing

**URL**: https://metamask.io
**Platform**: Browser extension (Chrome/Firefox/Brave)
**Why**: You need a wallet to test the wallet-connect flow, sign challenges, and sign blockchain transactions during Steps 2, 6, and 7.

### Steps
1. Go to https://metamask.io → **Download** → install the extension for your browser.
2. Open MetaMask → **Create a new wallet** → save the seed phrase somewhere secure and **offline**.
3. **Add Polygon Amoy network**:
   - In MetaMask click the network dropdown → **Add a custom network** → fill in:

   | Field | Value |
   |-------|-------|
   | Network name | Polygon Amoy |
   | New RPC URL | `https://rpc-amoy.polygon.technology` (or your Alchemy URL) |
   | Chain ID | `80002` |
   | Currency symbol | `MATIC` |
   | Block explorer URL | `https://amoy.polygonscan.com` |

4. **Get test MATIC**: go to https://faucet.polygon.technology → connect wallet → select Amoy → request MATIC (takes ~1 min).

> **Security rule**: Never use this development wallet for real funds. Keep a separate production wallet.

---

## 8. Polygonscan — Block Explorer + Contract Verification

**URL**: https://amoy.polygonscan.com
**Plan**: Free
**Why**: Used by Hardhat to verify (publish source code for) deployed contracts so anyone can read them on-chain. Also useful to inspect transactions during testing.

### Steps
1. Go to https://polygonscan.com → **Sign in** → **Register** if you don't have an account (Etherscan family — one account works across all chains).
2. After login: **My Account** → **API Keys** → **Add** → name it `creativechain-hardhat` → copy the key.

### Where it goes
```dotenv
# contracts/.env
POLYGONSCAN_API_KEY=YOUR_KEY
```

---

## 9. Deployer Wallet Private Key — Contract Deployment

> ⚠️ **Critical security item** — treat like a bank PIN.

The contracts (Step 6) need a wallet to sign and broadcast deployment transactions to Amoy. You need to export the private key of the MetaMask wallet you set up in step 7.

### Steps
1. In MetaMask: click the three-dot menu on your account → **Account details** → **Show private key** → authenticate → copy.
2. This key goes **only** in `contracts/.env` — it is in `.gitignore` and must never be committed.

### Where it goes
```dotenv
# contracts/.env — NEVER commit this file
PRIVATE_KEY=0xYOUR_PRIVATE_KEY
```

> **Best practice**: Fund this wallet with just enough MATIC for deployment + a few test transactions. Do not hold value in it.

---

## 10. Vercel — Frontend Deployment

**URL**: https://vercel.com
**Plan**: Free (Hobby tier — unlimited personal projects)
**Why**: One-command deploy for the Vite React frontend with automatic HTTPS and CDN.

### Steps
1. Go to https://vercel.com → **Sign up** with GitHub.
2. Click **Add New Project** → **Import Git Repository** → select your CreativeChain repo.
3. **Framework preset**: Vite (auto-detected) — Vercel will find `frontend/` as the root.
   - Set **Root Directory** to `frontend`.
   - Build Command: `npm run build` (auto-detected).
   - Output Directory: `dist` (auto-detected).
4. Under **Environment Variables**, add every `VITE_*` variable from `frontend/.env.example`:

   | Key | Value |
   |-----|-------|
   | `VITE_API_BASE_URL` | Your Heroku backend URL e.g. `https://creativechain.herokuapp.com` |
   | `VITE_RPC_URL` | Your Alchemy Amoy URL |
   | `VITE_WALLETCONNECT_PROJECT_ID` | From step 4 |
   | `VITE_CHAIN_ID` | `80002` |
   | `VITE_CHAIN_NAME` | `Polygon Amoy` |
   | `VITE_BLOCK_EXPLORER_URL` | `https://amoy.polygonscan.com` |
   | `VITE_CONTRACT_IP_REGISTRY_ADDRESS` | Filled after Step 6 deployment |
   | `VITE_CONTRACT_LICENSE_AGREEMENT_ADDRESS` | Filled after Step 6 deployment |
   | `VITE_CONTRACT_COLLABORATIVE_WORK_ADDRESS` | Filled after Step 6 deployment |

5. Click **Deploy**. Vercel gives you a `*.vercel.app` URL.
6. Copy that URL and add it to `backend/.env` CORS:
   ```dotenv
   CORS_ALLOWED_ORIGINS=https://your-app.vercel.app
   ```

---

## 11. Heroku — Backend API + Celery Worker Deployment

**URL**: https://heroku.com
**Plan**: Eco dynos ($5/month for 1,000 dyno-hours — cheapest paid tier; free tier was removed in 2022)
**Why**: Hosts the Django API (`web` dyno) and Celery worker (`worker` dyno). Eco dynos sleep after 30 min of inactivity — acceptable for Phase 1 beta.

### Steps
1. Go to https://heroku.com → **Sign up**.
2. Install the Heroku CLI: `npm install -g heroku` or follow https://devcenter.heroku.com/articles/heroku-cli.
3. From your terminal:
   ```bash
   heroku login
   cd /path/to/project/backend
   heroku create creativechain-api
   ```
4. Add buildpack (Python):
   ```bash
   heroku buildpacks:set heroku/python -a creativechain-api
   ```
5. Set all backend env vars:
   ```bash
   heroku config:set SECRET_KEY="..." DATABASE_URL="..." REDIS_URL="..." \
     POLYGON_AMOY_RPC_URL="..." PINATA_API_KEY="..." PINATA_SECRET_KEY="..." \
     SENDGRID_API_KEY="..." EMAIL_FROM="..." \
     CORS_ALLOWED_ORIGINS="https://your-app.vercel.app" \
     DEBUG=False ALLOWED_HOSTS="creativechain-api.herokuapp.com" \
     -a creativechain-api
   ```
6. Add a `Procfile` at `backend/Procfile` (already should exist or create):
   ```
   web: gunicorn creativechain.wsgi --workers 2 --bind 0.0.0.0:$PORT
   worker: celery -A creativechain worker -l info --concurrency 2
   ```
7. Deploy:
   ```bash
   git subtree push --prefix backend heroku main
   ```
8. Run migrations:
   ```bash
   heroku run python manage.py migrate -a creativechain-api
   ```

> **Note**: If you prefer using Supabase + Upstash (set up in steps 1 and 2), you do not need Heroku's Postgres/Redis add-ons — just use those external URLs.

---

## 12. GitHub — Source Control + CI

**URL**: https://github.com
**Plan**: Free
**Why**: Hosts the codebase, enables CI checks (lint, tests, security scans), and is required by Vercel and Heroku for automated deploys.

### Steps
1. Create a new **private** repository named `creativechain`.
2. Push the monorepo:
   ```bash
   cd /home/darkduty/project
   git remote add origin git@github.com:YOUR_USERNAME/creativechain.git
   git push -u origin main
   ```
3. Add repository **Secrets** (Settings → Secrets and variables → Actions) for any CI pipeline:

   | Secret name | Value |
   |-------------|-------|
   | `DATABASE_URL` | Supabase connection string |
   | `REDIS_URL` | Upstash Redis URL |
   | `SECRET_KEY` | Django secret key |
   | `POLYGON_AMOY_RPC_URL` | Alchemy URL |
   | `PINATA_API_KEY` | Pinata key |
   | `PINATA_SECRET_KEY` | Pinata secret |
   | `SENDGRID_API_KEY` | SendGrid key |
   | `POLYGONSCAN_API_KEY` | Polygonscan key |
   | `PRIVATE_KEY` | Deployer wallet private key |

> **Security**: These GitHub secrets are masked in logs and never exposed in pull request builds from forks.

---

## 13. Polygon Amoy Faucet — Test MATIC

**URL**: https://faucet.polygon.technology
**Plan**: Free (0.5–1 MATIC per request, once per 24 hours per address)
**Why**: Needed to pay gas fees when deploying contracts (Step 6) and running end-to-end tests.

### Steps
1. Go to https://faucet.polygon.technology.
2. Connect your MetaMask wallet or paste your deployer address.
3. Select **Amoy** from the dropdown.
4. Click **Submit** → wait ~30 seconds → MATIC arrives in your wallet.
5. Repeat once a day until you have 2–5 MATIC (enough for all Phase 1 contract deployments and test transactions).

> **Alternative faucets** if the main one is down:
> - https://www.alchemy.com/faucets/polygon-amoy (requires Alchemy login, gives 0.5 MATIC)
> - https://faucet.quicknode.com/polygon/amoy

---

## Setup Checklist

Use this in order — each row depends on the ones above it.

```
[ ] 1.  Supabase      → DATABASE_URL              → backend/.env
[ ] 2.  Upstash       → REDIS_URL                 → backend/.env
[ ] 3.  Alchemy       → POLYGON_AMOY_RPC_URL       → backend/.env, contracts/.env, frontend/.env
[ ] 4.  WalletConnect → VITE_WALLETCONNECT_PROJECT_ID → frontend/.env
[ ] 5.  Pinata        → PINATA_API_KEY/SECRET      → backend/.env
[ ] 6.  SendGrid      → SENDGRID_API_KEY, EMAIL_FROM → backend/.env
[ ] 7.  MetaMask      → install + add Amoy network + get test MATIC
[ ] 8.  Polygonscan   → POLYGONSCAN_API_KEY        → contracts/.env
[ ] 9.  Deployer key  → PRIVATE_KEY               → contracts/.env
[ ] 10. Vercel        → deploy frontend, add VITE_* env vars
[ ] 11. Heroku        → deploy backend + worker, set config vars
[ ] 12. GitHub        → push repo, add CI secrets
[ ] 13. Faucet        → fund deployer wallet with test MATIC
```

---

## .gitignore Reminder

Make sure these files are never committed:

```gitignore
# in project root .gitignore
backend/.env
frontend/.env
contracts/.env
backend/dump.rdb
```

Commit only the `.env.example` files (already present — they contain placeholders only).

