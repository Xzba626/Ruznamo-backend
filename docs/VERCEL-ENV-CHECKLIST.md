# Vercel Environment Variables — Checklist

## Your current error

```
Config validation error: "DATABASE_URL" is not allowed to be empty ...
```

This means variables exist in Vercel but have **empty values**, OR were copied from `.env.example` without real secrets.

**Never add empty placeholder keys to Vercel.**

---

## Step 1 — Generate secrets (PowerShell)

Run locally — copy output into Vercel (not into Git):

```powershell
# JWT_SECRET
[Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Maximum 256 }))

# Run again for JWT_REFRESH_SECRET and LICENSE_KEY_PEPPER
```

Each value must be **≥ 32 characters**.

---

## Step 2 — Neon connection strings

In [Neon Console](https://console.neon.tech) → your project → **Connect**:

| Vercel variable | Neon type |
|-----------------|-----------|
| `DATABASE_URL` | **Pooled** connection (host contains `-pooler`) |
| `DIRECT_URL` | **Direct** connection (no pooler) |

Copy full `postgresql://...` strings including `?sslmode=require`.

---

## Step 3 — Vercel Dashboard

**Project → Settings → Environment Variables**

Add each variable with a **real value**. Enable for **Production** (and Preview if needed).

| Variable | Example value | Required |
|----------|---------------|----------|
| `NODE_ENV` | `production` | yes |
| `DATABASE_URL` | `postgresql://...@ep-xxx-pooler.../neondb?sslmode=require` | yes |
| `DIRECT_URL` | `postgresql://...@ep-xxx.../neondb?sslmode=require` | yes |
| `JWT_SECRET` | (generated, ≥32 chars) | yes |
| `JWT_REFRESH_SECRET` | (generated, ≥32 chars) | yes |
| `LICENSE_KEY_PEPPER` | (generated, ≥32 chars) | yes |
| `API_BASE_URL` | `https://ruznamo-backend-o4xk.vercel.app` | yes |
| `APP_BASE_URL` | `https://ruznamo-backend-o4xk.vercel.app` | yes |
| `CORS_ORIGINS` | `*` or your Android/admin origins | yes |

**Do NOT add** `PORT`, `LOG_LEVEL`, or `THROTTLE_*` on Vercel — defaults apply automatically. If they already exist with empty/invalid values, **delete them**.

---

## Step 4 — Redeploy

After saving env vars:

**Deployments → latest → Redeploy** (required — env changes don't apply to old deployments automatically in all cases).

Or push a new commit.

### Why `nest: command not found` on build?

If `NODE_ENV=production` is set in Vercel, `npm install` skips **devDependencies** (`@nestjs/cli`, `typescript`). The repo uses `installCommand: npm install --include=dev` in `vercel.json` to fix this. Runtime still uses `NODE_ENV=production`.

### Why generic `FUNCTION_INVOCATION_FAILED` after env vars are set?

Common causes (fixed in latest `api/index.ts`):

1. **Express 4 + NestJS 11 conflict** — serverless entry must use Nest's built-in Express 5 instance, not a separate `express()` app.
2. **`API_BASE_URL` without `https://`** — use full URL or host only (auto-prefixed).
3. **Prisma eager connect on cold start** — on Vercel, DB connects on first query; `/health` should return 200 even before DB is ready.

---

## Step 5 — Run migrations (local machine, once)

```powershell
cd D:\Ruznamo-Backend

# Set Neon URLs temporarily in local .env (gitignored), then:
npx prisma migrate deploy
npm run prisma:seed
```

---

## Step 6 — Verify

```text
https://ruznamo-backend-o4xk.vercel.app/health
https://ruznamo-backend-o4xk.vercel.app/health/ready
https://ruznamo-backend-o4xk.vercel.app/api/v1/app/config?appVersion=1.0.0
```

| Endpoint | Expected |
|----------|----------|
| `/health` | `200` |
| `/health/ready` | `200` (needs DB + migrations) |
| `/api/v1/app/config` | `200` JSON |

---

## Common mistakes

| Mistake | Result |
|---------|--------|
| Empty values from `.env.example` | Config validation 500 |
| Only `DATABASE_URL`, no `DIRECT_URL` | Validation or migration fails |
| Pooled URL in `DIRECT_URL` | Migrations may fail |
| Forgot **Redeploy** after env change | Still 500 |
| Migrations not run on Neon | `/health/ready` fails |

---

See also: [NEON-SETUP.md](./NEON-SETUP.md), [DEPLOYMENT-VERCEL.md](./DEPLOYMENT-VERCEL.md)
