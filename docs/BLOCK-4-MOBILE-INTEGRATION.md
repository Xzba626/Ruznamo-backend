# BLOCK 4 — Mobile Backend Integration

Device-first mobile authentication for the Ruznamo Android application.

**Base URL (production):** `https://ruznamo-backend-o4xk.vercel.app`

Android communicates **only** with this HTTPS API. It must never connect to Neon, Prisma, or backend secrets directly.

---

## Architecture

```
Android App
    │  HTTPS (JWT + refresh token)
    ▼
NestJS Mobile API  (/api/v1/auth, /devices, /account, /licenses, /me)
    │
    ▼
Prisma → Neon PostgreSQL
```

Admin Panel uses a **separate** auth stack:

- Mobile JWT audience: `ruznamo-mobile`
- Admin JWT audience: `ruznamo-admin`
- Mobile tokens never pass admin guards; admin tokens never pass mobile guards.

---

## First Launch Flow

1. Android generates/persists `installationId` (UUID v4).
2. `GET /api/v1/app/config?appVersion=X` — maintenance, updates, announcement.
3. If no valid session: `POST /api/v1/auth/device/register`.
4. Store `accessToken` + `refreshToken` securely.
5. `GET /api/v1/me/entitlements` — trial/license/access state.
6. App starts when `access: true` (or shows paywall/update/maintenance UI).

---

## Response Envelope

Success:

```json
{
  "success": true,
  "data": { ... },
  "requestId": "..."
}
```

Error:

```json
{
  "success": false,
  "error": {
    "code": "DEVICE_LIMIT_REACHED",
    "message": "..."
  },
  "requestId": "..."
}
```

---

## Public Endpoints

### GET `/api/v1/app/config`

Query: `platform=ANDROID`, `appVersion=1.0.0`

Returns maintenance mode, Android version policy, optional announcement, server time.

---

## Authentication

### POST `/api/v1/auth/device/register`

Device-first registration. **No email/password.**

Request:

```json
{
  "installationId": "550e8400-e29b-41d4-a716-446655440000",
  "platform": "ANDROID",
  "appVersion": "1.0.0",
  "deviceName": "Samsung Galaxy S24",
  "category": "PERSONAL"
}
```

Behavior:

- New `installationId` → create `User`, `DeviceInstallation`, `TrialGrant`, issue tokens.
- Existing `installationId` → restore session, update metadata, issue tokens (idempotent).
- Same `installationId` never receives a second trial (DB unique constraint on `TrialGrant.installationId`).
- Blocked when `MAINTENANCE_MODE=true` → `503 MAINTENANCE_MODE`.

Response `data`:

```json
{
  "tokens": {
    "accessToken": "...",
    "refreshToken": "...",
    "expiresIn": 900,
    "tokenType": "Bearer"
  },
  "user": { "id": "...", "status": "ACTIVE", "category": "PERSONAL" },
  "device": { "id": "...", "installationId": "...", "status": "ACTIVE" },
  "trial": { "status": "ACTIVE", "expiresAt": "..." }
}
```

Rate limit: 10 req/min.

### POST `/api/v1/auth/refresh`

Request:

```json
{ "refreshToken": "..." }
```

Rotates refresh token (hashed at rest). Old token revoked; reuse returns `401 INVALID_REFRESH_TOKEN` or `REFRESH_TOKEN_EXPIRED`.

### POST `/api/v1/auth/logout`

Auth: Bearer mobile JWT.

Optional body: `{ "refreshToken": "..." }` — revokes matching session.

### POST `/api/v1/auth/logout-all`

Auth: Bearer mobile JWT. Revokes all active mobile refresh tokens for the user.

---

## Mobile JWT

Access token claims:

| Claim | Value |
|-------|-------|
| `sub` | `userId` |
| `deviceId` | current device |
| `installationId` | device installation UUID |
| `aud` | `ruznamo-mobile` |
| `type` | `access` |

Use header: `Authorization: Bearer <accessToken>`

---

## Entitlements

### GET `/api/v1/me/entitlements`

Auth: Bearer mobile JWT.

```json
{
  "access": true,
  "source": "TRIAL",
  "effectiveStatus": "TRIAL",
  "plan": { "code": "STANDARD", "name": "Standard" },
  "trial": { "status": "ACTIVE", "expiresAt": "...", "startedAt": "..." },
  "license": null,
  "devices": { "active": 1, "max": 1, "currentInstallationActive": true },
  "features": {
    "planning_horizon_days": 28,
    "max_devices": 1,
    "cloud_sync": false,
    "advanced_analytics": false
  },
  "evaluatedAt": "..."
}
```

`source`: `TRIAL` | `LICENSE` | `NONE`

Device limits come from `PlanFeature.max_devices` (STANDARD=1, PRO=2).

---

## Devices

### POST `/api/v1/devices/register`

Auth required. Register an **additional** device for the same user (e.g. second phone on PRO plan).

Same body shape as auth device register. Rejects when `DEVICE_LIMIT_REACHED`.

### GET `/api/v1/devices`

Lists all devices for the current user.

### POST `/api/v1/devices/revoke`

```json
{ "deviceId": "..." }
```

Revokes device and associated refresh sessions. Cannot revoke another user's device.

---

## Account

### GET `/api/v1/account`

Returns safe profile fields (no tokens/hashes).

### PATCH `/api/v1/account`

```json
{
  "displayName": "Teacher Name",
  "category": "TEACHER",
  "phone": "+992..."
}
```

---

## Licenses

### POST `/api/v1/licenses/activate`

```json
{ "licenseKey": "RZ-XXXX-XXXX-XXXX" }
```

License keys are hashed (HMAC) before lookup. Never stored or returned in plain text.

Errors: `LICENSE_INVALID`, `LICENSE_REVOKED`, `LICENSE_EXPIRED`, `LICENSE_ALREADY_ACTIVATED`, `LICENSE_ACTIVATION_LIMIT`.

### GET `/api/v1/licenses/me`

Returns user's licenses and activations (prefix only, no secrets).

---

## Admin App Config

### GET `/api/v1/admin/app-config`

Permission: `config:read`

### PATCH `/api/v1/admin/app-config`

Permission: `config:update`

Manages maintenance, announcements, Android version policy via `SystemConfig` + `AppVersion`.

---

## Error Codes

| Code | HTTP | Meaning |
|------|------|---------|
| `MAINTENANCE_MODE` | 503 | Service in maintenance |
| `DEVICE_LIMIT_REACHED` | 403 | Plan device cap exceeded |
| `DEVICE_REVOKED` | 403 | Installation revoked |
| `INVALID_REFRESH_TOKEN` | 401 | Bad/reused refresh token |
| `REFRESH_TOKEN_EXPIRED` | 401 | Refresh token expired |
| `LICENSE_INVALID` | 404 | Unknown license key |
| `LICENSE_REVOKED` | 403 | License revoked |
| `LICENSE_EXPIRED` | 403 | License expired |
| `LICENSE_ALREADY_ACTIVATED` | 403 | Bound to another user |
| `INSTALLATION_IN_USE` | 409 | Installation owned by another account |

---

## Environment Variables (backend only)

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Neon pooled connection |
| `DIRECT_URL` | Neon direct (migrations) |
| `JWT_SECRET` | Access token signing |
| `JWT_REFRESH_SECRET` | Reserved |
| `JWT_ACCESS_EXPIRES_IN` | Default `15m` |
| `JWT_REFRESH_EXPIRES_IN` | Default `30d` |
| `LICENSE_KEY_PEPPER` | License key HMAC |
| `CORS_ORIGINS` | Allowed origins |
| `TRIAL_DURATION_HOURS` | Via `SystemConfig` seed (24h) |

Android must **not** receive any of these.

---

## Deployment Steps

1. Apply migration: `npx prisma migrate deploy`
2. Seed/update config: `npm run prisma:seed`
3. Verify: `npm run build && npm test`
4. Deploy backend to Vercel
5. Test flow: app config → device register → entitlements → refresh

---

## Audit Events

- `user.registered`
- `device.registered` / `device.revoked`
- `mobile.login` / `mobile.refresh` / `mobile.logout` / `mobile.logout_all`
- `trial.granted`
- `license.activated`

---

## Out of Scope (BLOCK 5+)

- Telegram User Bot
- Android app code (separate repository)
- Email/password registration
