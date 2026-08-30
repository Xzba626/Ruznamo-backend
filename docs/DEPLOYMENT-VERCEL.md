# Vercel Deployment — Ruznamo Backend

> See also: [NEON-SETUP.md](./NEON-SETUP.md) for database configuration.

## Architecture on Vercel

```text
Client → Vercel Edge → api/index.ts (serverless) → NestJS → Neon (pooled DATABASE_URL)
```

Migrations run **outside** Vercel using `DIRECT_URL`. See [NEON-SETUP.md](./NEON-SETUP.md).

---

## 1. Create Vercel project

1. [vercel.com](https://vercel.com) → Add New Project
2. Import GitHub repository `ruznamo-backend`
3. Framework Preset: **Other**
4. Root Directory: `.`

---

## 2. Build settings

Configured in `vercel.json`:

| Setting | Value |
|---------|-------|
| Install Command | `npm install --include=dev` |
| Build Command | `npm run vercel-build` |
| Output Directory | *(empty — serverless API)* |
| Node.js | 20.x |

---

## 3. Environment variables

**Project → Settings → Environment Variables**

> ⚠️ **Do NOT copy empty placeholders from `.env.example`.**  
> Each variable must have a **real value**. Empty strings cause `Config validation error` and HTTP 500.  
> See **[VERCEL-ENV-CHECKLIST.md](./VERCEL-ENV-CHECKLIST.md)** for step-by-step setup.

Never commit these to Git.

| Variable | Required | Source |
|----------|----------|--------|
| `NODE_ENV` | yes | `production` |
| `DATABASE_URL` | yes | Neon **pooled** connection |
| `DIRECT_URL` | yes | Neon **direct** connection |
| `JWT_SECRET` | yes | Generate ≥32 chars |
| `JWT_REFRESH_SECRET` | yes | Generate ≥32 chars |
| `LICENSE_KEY_PEPPER` | yes | Generate ≥32 chars |
| `API_BASE_URL` | yes | `https://your-app.vercel.app` |
| `APP_BASE_URL` | yes | Same as API base |
| `CORS_ORIGINS` | yes | Comma-separated origins |
| `TELEGRAM_USER_BOT_TOKEN` | BLOCK 5+ | BotFather token |
| `TELEGRAM_ADMIN_BOT_TOKEN` | BLOCK 6+ | BotFather token |
| `TELEGRAM_WEBHOOK_SECRET` | BLOCK 5+ | Random secret for webhook validation |
| `ADMIN_TELEGRAM_CHAT_ID` | BLOCK 6+ | Admin Telegram chat/user ID |

Copy variable names from `.env.example` — values are **never** in the repository.

---

## 4. Database migration strategy

**Before first production deploy:**

```bash
# From local machine with Neon URLs in environment
npx prisma migrate deploy
npm run prisma:seed
```

**Do not** run migrations inside the serverless function on each request.

---

## 5. Deploy

```bash
git push origin main
```

Vercel auto-deploys on push to connected branch.

---

## 6. Verify deployment

```bash
curl -s https://YOUR_DOMAIN/health
curl -s https://YOUR_DOMAIN/health/ready
curl -s "https://YOUR_DOMAIN/api/v1/app/config?appVersion=1.0.0"
```

| Endpoint | Expected |
|----------|----------|
| `/health` | `200` — liveness (no DB required) |
| `/health/ready` | `200` — database reachable |
| `/api/v1/app/config` | `200` — JSON with `configVersion`, `android`, `maintenance` |

Swagger: `https://YOUR_DOMAIN/api/docs`

---

## 7. Telegram webhooks (BLOCK 5+)

**Do not use polling on Vercel.**

Register webhook with Telegram:

```text
https://YOUR_DOMAIN/api/v1/telegram/webhook/user
```

Set `TELEGRAM_WEBHOOK_SECRET` and validate on each request.

Admin bot: separate webhook path with admin chat ID whitelist.

---

## 8. Serverless adapter

| File | Role |
|------|------|
| `api/index.ts` | Vercel entry — `@vendia/serverless-express` |
| `src/bootstrap.ts` | Shared NestJS middleware config |
| `src/main.ts` | Local development only (`npm run start:dev`) |

---

## 9. Known limitations

| Feature | Vercel support |
|---------|----------------|
| HTTP REST API | ✅ |
| Telegram polling | ❌ use webhooks |
| Background outbox worker | ❌ separate worker service |
| Long-running cron | ❌ use Vercel Cron or external scheduler |

---

## 10. Troubleshooting

### `FUNCTION_INVOCATION_FAILED` / `SERVERLESS_BOOTSTRAP_FAILED`

1. Check Vercel **Functions** logs
2. Verify all required env vars are set (including `DIRECT_URL`)
3. Confirm `prisma migrate deploy` was run on Neon
4. Redeploy after env changes

### `/health` works, `/health/ready` fails

Database connection issue — check pooled `DATABASE_URL`, Neon project status, SSL.

### Admin Panel not visible

Expected — Admin Panel is a separate frontend repository.

---

## Related

- [NEON-SETUP.md](./NEON-SETUP.md)
- [PRODUCTION-CHECKLIST.md](./PRODUCTION-CHECKLIST.md)
- [VERCEL-DEPLOYMENT.md](./VERCEL-DEPLOYMENT.md) — historical root-cause notes
