# Neon PostgreSQL Setup — Ruznamo Backend

## Overview

Ruznamo uses [Neon](https://neon.tech) for production PostgreSQL.

Neon provides **two** connection strings:

| Variable | Type | Used by |
|----------|------|---------|
| `DATABASE_URL` | **Pooled** | NestJS runtime, Vercel serverless, app queries |
| `DIRECT_URL` | **Direct / unpooled** | `prisma migrate deploy`, schema operations |

**Never commit real connection strings to Git.**

---

## 1. Create Neon project

1. Sign in at [console.neon.tech](https://console.neon.tech)
2. Create project (e.g. `ruznamo-production`)
3. Select region closest to Vercel deployment (e.g. `us-east-1` if Vercel is `iad1`)

---

## 2. Get connection strings

In Neon Console → **Connect**:

### Pooled connection → `DATABASE_URL`

Enable **Connection pooling** (PgBouncer). Copy the pooled URI.

Example shape (not a real secret):

```text
postgresql://USER:PASSWORD@ep-xxx-pooler.region.aws.neon.tech/DBNAME?sslmode=require
```

### Direct connection → `DIRECT_URL`

Disable pooling / use direct host. Copy the direct URI.

Example shape:

```text
postgresql://USER:PASSWORD@ep-xxx.region.aws.neon.tech/DBNAME?sslmode=require
```

---

## 3. Prisma configuration

Already configured in `prisma/schema.prisma`:

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

- **Runtime** (`PrismaService`) uses `DATABASE_URL` (pooled)
- **Migrations** use `DIRECT_URL` automatically via `directUrl`

---

## 4. Local development

### Option A — Docker Postgres (no Neon)

```bash
docker compose up -d postgres
```

In `.env` (local only, gitignored):

```text
DATABASE_URL=postgresql://ruznamo:ruznamo@localhost:5432/ruznamo?schema=public
DIRECT_URL=postgresql://ruznamo:ruznamo@localhost:5432/ruznamo?schema=public
```

For local Docker, pooled and direct URLs are the same.

### Option B — Neon for local dev

Use Neon **development** branch connection strings in local `.env`.

---

## 5. Apply migrations (production / staging)

Run from your machine or CI — **not** inside Vercel serverless function:

```bash
# Set DIRECT_URL and DATABASE_URL in shell or .env
npx prisma migrate deploy
npm run prisma:seed
```

Verify:

```bash
npx prisma db execute --stdin <<< "SELECT 1"
```

---

## 6. Vercel environment variables

Vercel Dashboard → Project → Settings → Environment Variables:

| Name | Value source |
|------|----------------|
| `DATABASE_URL` | Neon **pooled** connection string |
| `DIRECT_URL` | Neon **direct** connection string |

Apply to: Production, Preview, Development (as needed).

Also set JWT secrets, `LICENSE_KEY_PEPPER`, `API_BASE_URL`, etc. See `.env.example`.

**Do not paste connection strings into GitHub or source code.**

---

## 7. Connection limits (serverless)

Vercel functions are short-lived. Always use **pooled** `DATABASE_URL` at runtime.

Symptoms of wrong configuration:

- `Too many connections`
- Intermittent `P1001` / timeout on cold start

Mitigation:

- Pooled Neon URL
- Consider `?connection_limit=1` on serverless if needed
- Prisma Accelerate (optional, future)

---

## 8. Branching (optional)

Neon supports database branches per environment:

| Branch | Use |
|--------|-----|
| `main` | production |
| `staging` | preview deployments |
| `dev` | local development |

Each branch has its own pooled + direct URLs.

---

## 9. Security checklist

- [ ] Connection strings only in Vercel env / local `.env`
- [ ] `.env` in `.gitignore`
- [ ] `.env.example` has empty placeholders only
- [ ] Neon IP allowlist configured if required
- [ ] Rotate credentials if ever exposed

---

## 10. Troubleshooting

| Error | Fix |
|-------|-----|
| `P1000 Authentication failed` | Wrong password or URL in env |
| `P1001 Can't reach database` | Wrong host, SSL, or Neon paused |
| Migration fails on pooled URL | Ensure `DIRECT_URL` is set in schema |
| App works locally, fails on Vercel | Check Vercel env vars + redeploy |

---

## Related docs

- [DEPLOYMENT-VERCEL.md](./DEPLOYMENT-VERCEL.md)
- [PRODUCTION-CHECKLIST.md](./PRODUCTION-CHECKLIST.md)
