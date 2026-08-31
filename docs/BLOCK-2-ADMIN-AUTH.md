# BLOCK 2 — Admin Auth Foundation (Report)

> Status: **Backend implemented** — Admin Panel UI is **BLOCK 3** (separate frontend repo).

## What was built

Secure admin authentication for Ruznamo — no public registration, CLI bootstrap for first OWNER, JWT + refresh rotation, audit logging, Telegram link-token API (bot webhook in BLOCK 6).

### Architecture alignment

| Principle | Implementation |
|-----------|----------------|
| No `POST /admin/register` | Only `POST /api/v1/admin/auth/login` (+ refresh/logout/me) |
| OWNER bootstrap | `npm run admin:bootstrap` — one-time SUPER_ADMIN |
| Reuse existing schema | `AdminUser` + RBAC (`SUPER_ADMIN` = OWNER) |
| DB is source of truth for Telegram | `AdminTelegramIdentity` + one-time `AdminTelegramLinkToken` |
| Env fallback | `ADMIN_TELEGRAM_CHAT_ID` / `ADMIN_TELEGRAM_IDS` checked during bot link |
| Admin Panel → API only | No frontend in this repo yet |

---

## Prisma changes

**Migration:** `prisma/migrations/20260830181500_admin_auth/migration.sql`

| Model | Purpose |
|-------|---------|
| `AdminRefreshToken` | Server-side admin refresh sessions (hashed) |
| `AdminTelegramIdentity` | Verified admin ↔ Telegram binding |
| `AdminTelegramLinkToken` | One-time codes from Admin Panel “Connect Telegram” |

**Extended:** `AdminUser` relations (no duplicate user table).

**Apply on Neon:**

```powershell
cd D:\Ruznamo-Backend
npx prisma migrate deploy
```

---

## API endpoints added

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/v1/admin/auth/login` | Public | Username + password → tokens |
| `POST` | `/api/v1/admin/auth/refresh` | Public | Refresh token rotation |
| `POST` | `/api/v1/admin/auth/logout` | Bearer | Revoke refresh session |
| `GET` | `/api/v1/admin/auth/me` | Bearer | Current admin profile |
| `POST` | `/api/v1/admin/telegram/connect` | Bearer | One-time link code (15 min) |
| `GET` | `/api/v1/admin/telegram/status` | Bearer | Telegram connection status |

**JWT audience:** `ruznamo-admin` (separate from Android `ruznamo-mobile`).

---

## Bootstrap (first OWNER)

```powershell
cd D:\Ruznamo-Backend
# Ensure seed ran: npm run prisma:seed
npm run admin:bootstrap
```

Prompts: username (stored as `AdminUser.email`), password (min 12 chars), confirm.

- Creates **one** `SUPER_ADMIN` (OWNER)
- Fails if OWNER already exists
- Password stored as **bcrypt** hash only

Then login:

```http
POST /api/v1/admin/auth/login
Content-Type: application/json

{
  "username": "owner@ruznamo.local",
  "password": "your-password"
}
```

---

## Telegram binding (admin)

1. Login to Admin Panel (BLOCK 3) or use API with Bearer token
2. `POST /api/v1/admin/telegram/connect` → code `RZ-XXXXXX` + optional deep link
3. OWNER opens admin bot with `/start <code>` (BLOCK 6 webhook calls `AdminTelegramService.completeLinkFromBot`)
4. `GET /api/v1/admin/telegram/status` → `connected: true`

`ADMIN_TELEGRAM_IDS` in Vercel env acts as **bootstrap allowlist** until DB identity exists.

---

## Security controls

- bcrypt password hashing (cost 12)
- Opaque refresh tokens, SHA-256 hash in DB
- Refresh token rotation on `/refresh`
- Login rate limit: 5/min per IP (Throttler)
- Generic error: `Invalid username or password` (no user enumeration)
- Audit log: login success/fail, refresh, logout, telegram link
- Passwords/tokens redacted in Pino logs
- Guards only on `/api/v1/admin/*` (health/app config unaffected)

---

## Files added/changed (main)

```
prisma/schema.prisma
prisma/migrations/20260830181500_admin_auth/
scripts/admin-bootstrap.ts
src/admin/
src/audit/
src/security/
src/app.module.ts
package.json
docs/BLOCK-2-ADMIN-AUTH.md (this file)
```

---

## Not in this block (by design)

- Admin Panel UI (BLOCK 3)
- Telegram bot webhook + commands (BLOCK 6)
- Android auth (BLOCK 7)
- Dashboard/users/licenses CRUD APIs (BLOCK 4–5)

---

## Your next steps

1. **Push** to `main` → Vercel redeploy
2. **Migrate Neon:** `npx prisma migrate deploy`
3. **Bootstrap OWNER locally** against Neon (once): `npm run admin:bootstrap`
4. **Test login** on production Swagger `/api/docs`
5. When ready: **BLOCK 3** — TailAdmin frontend in separate folder
