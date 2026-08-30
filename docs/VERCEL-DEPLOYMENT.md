# Vercel Deployment — Ruznamo Backend

## Root cause of `FUNCTION_INVOCATION_FAILED`

The initial deployment failed because:

1. **No serverless entrypoint** — `src/main.ts` calls `app.listen()`, which is incompatible with Vercel serverless functions.
2. **No `vercel.json`** — Vercel did not know how to route requests to a NestJS application.
3. **Missing Prisma Lambda binary target** — Prisma Client on Vercel requires `rhel-openssl-3.0.x` in `binaryTargets`.
4. **Required environment variables** — Joi validation fails at bootstrap if secrets/DB URL are missing in Vercel.

## Fix applied

| File | Purpose |
|------|---------|
| `api/index.ts` | Vercel serverless handler via `@vendia/serverless-express` |
| `vercel.json` | Build command, rewrites, function limits |
| `src/bootstrap.ts` | Shared NestJS configuration for local + serverless |
| `prisma/schema.prisma` | `binaryTargets = ["native", "rhel-openssl-3.0.x"]` |

## Vercel project settings

| Setting | Value |
|---------|-------|
| Framework Preset | Other |
| Root Directory | `.` |
| Install Command | `npm install` |
| Build Command | `npx prisma generate && npm run build` |
| Output Directory | *(leave empty for serverless API)* |
| Node.js Version | 20.x |

`vercel.json` in the repository should override these automatically after redeploy.

## Required environment variables (Vercel Dashboard)

Set these in **Project → Settings → Environment Variables**:

| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | yes | PostgreSQL connection string (use pooled URL for serverless when possible) |
| `JWT_SECRET` | yes | min 32 characters |
| `JWT_REFRESH_SECRET` | yes | min 32 characters |
| `LICENSE_KEY_PEPPER` | yes | min 32 characters |
| `NODE_ENV` | yes | `production` |
| `API_BASE_URL` | yes | `https://ruznamo-backend-o4xk.vercel.app` |
| `APP_BASE_URL` | yes | same as API base for now |
| `CORS_ORIGINS` | yes | comma-separated allowed origins |
| `TELEGRAM_USER_BOT_TOKEN` | later | empty until Telegram block |
| `TELEGRAM_ADMIN_BOT_TOKEN` | later | empty until Telegram block |
| `ADMIN_TELEGRAM_IDS` | later | optional |

## Database on Vercel

Use a hosted PostgreSQL provider:

- [Neon](https://neon.tech)
- [Supabase](https://supabase.com)
- [Railway](https://railway.app)

### Migrations

Run migrations **outside** the serverless function:

```bash
DATABASE_URL="postgresql://..." npx prisma migrate deploy
DATABASE_URL="postgresql://..." npm run prisma:seed
```

Do not rely on `prisma migrate` during every cold start.

### Connection pooling

For serverless, prefer a pooled connection string:

```
postgresql://user:pass@host/db?pgbouncer=true&connection_limit=1
```

Or use Prisma Accelerate if adopted later.

## Deployment commands

```bash
git add .
git commit -m "fix: add Vercel serverless adapter for NestJS"
git push origin main
```

Vercel redeploys automatically on push.

## Verify after deploy

```bash
curl https://ruznamo-backend-o4xk.vercel.app/health
curl https://ruznamo-backend-o4xk.vercel.app/health/ready
curl https://ruznamo-backend-o4xk.vercel.app/api/v1/app/config
```

Expected:

- `/health` → `200` even if DB is down (liveness)
- `/health/ready` → `200` only when PostgreSQL is reachable
- `/api/v1/app/config` → `200` with maintenance + android config

## Important limitations

Vercel is suitable for **HTTP API** only.

**Not suitable on Vercel alone:**

- Long-running Telegram bots (polling)
- Background outbox workers
- Persistent websocket connections

Plan separate deployment (VPS, Railway, Fly.io) for Telegram bot workers when BLOCK 5 is implemented.

## Troubleshooting

### `SERVERLESS_BOOTSTRAP_FAILED`

Check Vercel function logs. Common causes:

- missing `DATABASE_URL`
- invalid JWT secrets (too short)
- Prisma cannot connect
- migration not applied

### `500` on `/health/ready` only

Database connectivity issue. Liveness `/health` should still work.

### Admin Panel not visible

Expected. Admin Panel is a **separate frontend** — see `docs/ADMIN-ARCHITECTURE.md`.
