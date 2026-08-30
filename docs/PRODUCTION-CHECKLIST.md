# Production Checklist

## Pre-deploy

- [ ] PostgreSQL provisioned (Neon/Supabase/Railway)
- [ ] `npx prisma migrate deploy` run against production DB
- [ ] `npm run prisma:seed` run once (STANDARD plan + RBAC + config)
- [ ] All Vercel env vars set (see `docs/VERCEL-DEPLOYMENT.md`)
- [ ] `API_BASE_URL` matches deployed domain
- [ ] `CORS_ORIGINS` includes Admin Panel origin when ready

## Post-deploy smoke tests

```bash
curl -s https://YOUR_DOMAIN/health | jq
curl -s https://YOUR_DOMAIN/health/ready | jq
curl -s https://YOUR_DOMAIN/api/v1/app/config | jq
```

## Security

- [ ] No `.env` in git
- [ ] JWT secrets ≥ 32 chars, unique per environment
- [ ] `LICENSE_KEY_PEPPER` only on server
- [ ] Production `NODE_ENV=production`
- [ ] No stack traces in API responses

## Not yet required (future blocks)

- [ ] Auth endpoints live
- [ ] License activation live
- [ ] Telegram bots deployed on worker infrastructure
- [ ] Admin Panel connected to Admin API
- [ ] Full e2e test suite green against production-like env

## Current commercial rules

- Active plan: **STANDARD** only (15 TJS/month, 150 TJS/year)
- Trial: **24 hours** (`TRIAL_DURATION_HOURS` in SystemConfig)
- Max devices: **1**
