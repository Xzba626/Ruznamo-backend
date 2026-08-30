# Ruznamo Backend

Production-oriented REST API for the **Ruznamo** Android application, Telegram bots, and Admin Panel.

**Current status:** BLOCK 1 complete — foundation (NestJS, PostgreSQL, Prisma, health, security middleware, OpenAPI, tests).

## Architecture

- **NestJS 11** + **TypeScript** (strict)
- **PostgreSQL 16** + **Prisma 6**
- Modular monolith: auth, licenses, orders, telegram, admin (upcoming blocks)
- **STANDARD** plan active in production seed; PRO / PRO_PLUS exist in schema but are inactive
- Server is the source of truth for commercial entitlements; Android stays offline-first

See `docs/` for full architecture and API contract.

## Requirements

- Node.js **20.19+** (LTS recommended)
- Docker Desktop (for local PostgreSQL)
- npm 10+

## Quick start (local)

### 1. Clone / open project

```bash
cd D:\Ruznamo-Backend
```

### 2. Environment

```bash
cp .env.example .env
```

Edit `.env` if needed. Never commit real secrets.

### 3. Start PostgreSQL

```bash
docker compose up -d postgres
```

### 4. Install dependencies

```bash
npm install
```

### 5. Database migration & seed

```bash
npx prisma migrate dev --name init
npm run prisma:seed
```

Seed creates:

- **STANDARD** plan (15 TJS/month, 150 TJS/year, features)
- PRO / PRO_PLUS rows (inactive, for future use)
- RBAC roles & permissions
- `TRIAL_DURATION_HOURS=24` in SystemConfig
- Default Android app version config

### 6. Run API

```bash
npm run start:dev
```

### 7. Verify

| Endpoint | URL |
|----------|-----|
| Liveness | http://localhost:3000/health |
| Readiness | http://localhost:3000/health/ready |
| Swagger UI | http://localhost:3000/api/docs |
| OpenAPI JSON | http://localhost:3000/api/docs-json |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run start:dev` | Development with watch |
| `npm run build` | Compile TypeScript |
| `npm run lint` | ESLint |
| `npm test` | Unit tests |
| `npm run test:e2e` | E2E tests (requires PostgreSQL) |
| `npm run prisma:migrate` | Create/apply migrations |
| `npm run prisma:seed` | Seed reference data |

## Docker (API + PostgreSQL)

```bash
docker compose up --build
```

Runs PostgreSQL and the API container (applies migrations on start).

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `JWT_SECRET` | yes | Access token secret (min 32 chars) |
| `JWT_REFRESH_SECRET` | yes | Refresh token secret (min 32 chars) |
| `LICENSE_KEY_PEPPER` | yes | HMAC pepper for license keys |
| `CORS_ORIGINS` | no | Comma-separated allowed origins |
| `API_BASE_URL` | no | Public API base URL |
| `TELEGRAM_USER_BOT_TOKEN` | no | User payment bot (BLOCK 5) |
| `TELEGRAM_ADMIN_BOT_TOKEN` | no | Admin bot (BLOCK 5) |
| `TRIAL_DURATION_HOURS` | seeded | Configurable via `SystemConfig` table |

Full list: `.env.example`

## Product rules (authoritative)

- **Active commercial plan:** STANDARD only (15 TJS/month, 150 TJS/year, 1 device, 28-day horizon)
- **Trial:** 24 hours by default (`SystemConfig.TRIAL_DURATION_HOURS`), server-side `TrialGrant` — not reset on reinstall
- **License keys:** `RZNM-XXXX-XXXX-XXXX-XXXX`, HMAC-hashed in DB
- **Android:** device-first auth, `GET /me/entitlements` as primary sync endpoint (BLOCK 2+)

## Project layout

```
src/
  config/       # Env validation & typed config
  common/       # Global filters, interceptors, DTOs
  prisma/       # PrismaService
  health/       # Liveness & readiness
prisma/
  schema.prisma # Full domain schema (foundation)
  seed.ts       # STANDARD plan + RBAC + config
docs/           # Architecture & API contract
```

## Implementation roadmap

| Block | Status |
|-------|--------|
| BLOCK 1 — Foundation | ✅ |
| BLOCK 2 — Auth + users + devices | pending |
| BLOCK 3 — Plans + entitlements + licenses | pending |
| BLOCK 4 — Orders + receipts + approval | pending |
| BLOCK 5 — Telegram bots | pending |
| BLOCK 6 — Admin API | pending |
| BLOCK 7 — Security hardening | pending |
| BLOCK 8 — Full test suite | pending |

## Deployment note

This backend uses long-running processes (Telegram bots, background outbox). Choose deployment (VPS, Railway, Fly.io, etc.) accordingly — not a simple static/Vercel-only setup.

## Troubleshooting

### Docker not installed

Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) and run:

```bash
docker compose up -d postgres
```

### `P1000: Authentication failed`

PostgreSQL is reachable but credentials do not match `.env`. Either:

1. Start the project database: `docker compose up -d postgres` (uses `ruznamo`/`ruznamo`), or
2. Update `DATABASE_URL` in `.env` to match your local PostgreSQL instance.

Then run:

```bash
npx prisma migrate deploy
npm run prisma:seed
npm run test:e2e
```

## License

Private — Ruznamo commercial project.
