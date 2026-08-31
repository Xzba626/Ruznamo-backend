# BLOCK 3 — Admin Panel Foundation

## Scope

BLOCK 3 adds:

- Backend admin APIs (dashboard, users, licenses, devices, audit, system, password change)
- Telegram admin bot webhook architecture (identity binding only)
- `admin-panel/` — Vite + React admin UI (login, layout, all foundation pages)

BLOCK 1 and BLOCK 2 remain unchanged in behavior.

## Architecture

```
Admin Panel (Vite/React)
    │ HTTPS + JWT (sessionStorage)
    ▼
Ruznamo Backend (NestJS on Vercel)
    │ Prisma
    ▼
Neon PostgreSQL

Telegram Admin Bot
    │ HTTPS webhook
    ▼
POST /api/v1/telegram/admin/webhook
```

**No direct Neon access from Admin Panel or Telegram.**

## Admin authentication

- Login: `POST /api/v1/admin/auth/login` (username = admin email)
- Session: access + refresh tokens in `sessionStorage`
- Auto-refresh on 401 via `POST /api/v1/admin/auth/refresh`
- Logout: `POST /api/v1/admin/auth/logout`
- Password change: `POST /api/v1/admin/auth/change-password` (revokes refresh tokens)

**No public registration.** OWNER is created once:

```bash
npm run admin:bootstrap
```

## New backend endpoints

| Method | Path | Permission |
|--------|------|------------|
| GET | `/api/v1/admin/dashboard/summary` | `dashboard:read` |
| GET | `/api/v1/admin/users` | `users:read` |
| GET | `/api/v1/admin/users/:id` | `users:read` |
| GET | `/api/v1/admin/licenses` | `licenses:read` |
| GET | `/api/v1/admin/licenses/:id` | `licenses:read` |
| PATCH | `/api/v1/admin/licenses/:id/revoke` | `licenses:write` |
| GET | `/api/v1/admin/devices` | `devices:read` |
| GET | `/api/v1/admin/audit` | `audit:read` |
| GET | `/api/v1/admin/system/status` | `system:read` |
| POST | `/api/v1/admin/auth/change-password` | authenticated |
| POST | `/api/v1/telegram/admin/webhook` | public (secret header) |

Existing BLOCK 2 endpoints unchanged.

## Telegram binding flow

1. OWNER logs into Admin Panel
2. Opens **Telegram** → **Generate connection code** (`POST /api/v1/admin/telegram/connect`)
3. Sends `/start RZ-XXXXXX` to Admin Bot
4. Webhook validates one-time code and stores numeric Telegram user ID in `AdminTelegramIdentity`
5. Admin Panel shows **Connected**

Bot tokens stay server-side (`TELEGRAM_ADMIN_BOT_TOKEN`). Do not configure webhook until architecture is verified locally.

### Webhook setup (when ready)

```bash
curl -X POST "https://api.telegram.org/bot<TELEGRAM_ADMIN_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://ruznamo-backend-o4xk.vercel.app/api/v1/telegram/admin/webhook",
    "secret_token": "<TELEGRAM_WEBHOOK_SECRET>"
  }'
```

Vercel env:

- `TELEGRAM_ADMIN_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- `TELEGRAM_ADMIN_BOT_USERNAME` (optional, for deep links)

## Admin Panel local development

```bash
cd admin-panel
cp .env.example .env
# VITE_API_BASE_URL=https://ruznamo-backend-o4xk.vercel.app
npm install
npm run dev
```

Add admin panel origin to backend `CORS_ORIGINS` on Vercel (e.g. `http://localhost:5173` for dev).

> If `npm install` skips devDependencies, ensure `NODE_ENV` is not `production`, or use `admin-panel/.npmrc` (`production=false`).

## Admin Panel routes

| Route | Page |
|-------|------|
| `/login` | Sign in |
| `/` | Dashboard |
| `/users` | Users list |
| `/licenses` | Licenses list + revoke |
| `/devices` | Devices list |
| `/telegram` | Connection code + status |
| `/audit` | Audit logs |
| `/system` | Health / version |
| `/profile` | Profile + password change |

## Deploy admin panel

Static build:

```bash
cd admin-panel
npm run build
```

Deploy `admin-panel/dist` to Vercel/Netlify/static host. Set `VITE_API_BASE_URL` at build time to production backend URL.

## Tests

```bash
npm test
npm run build
cd admin-panel && npm run build
```

## Remaining gaps (post BLOCK 3)

- License **create** / extend flows (list + revoke only)
- Device **revoke** admin action
- Full audit filters (date/actor UI)
- User detail drawer/page
- Telegram admin commands beyond `/help` and `/status`
- E2E tests for admin panel
- Production admin panel deployment + CORS

## Security checklist

- [x] No public admin registration
- [x] JWT secrets server-side only
- [x] Bot tokens server-side only
- [x] License key hash/pepper never exposed
- [x] RBAC enforced on backend
- [x] Generic login error message
- [x] Refresh token rotation (BLOCK 2)
- [x] One-time Telegram link codes
