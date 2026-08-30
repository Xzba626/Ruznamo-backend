# API Contract — Ruznamo Backend v1

> Base URL: `{API_BASE_URL}/api/v1`  
> Date format: **ISO 8601 UTC** — `2026-08-30T10:00:00.000Z`  
> All authenticated requests: `Authorization: Bearer <accessToken>`  
> Optional idempotency: `Idempotency-Key: <uuid-v4>`

---

## Standard response envelope

### Success

```json
{
  "success": true,
  "data": { },
  "requestId": "01J8ZQ3K9M2P4R6S8T0V2X4Y6"
}
```

### Error

```json
{
  "success": false,
  "error": {
    "code": "LICENSE_EXPIRED",
    "message": "Литсензия ба анҷом расид.",
    "details": {}
  },
  "requestId": "01J8ZQ3K9M2P4R6S8T0V2X4Y6"
}
```

### Common error codes

| HTTP | code | When |
|------|------|------|
| 400 | `VALIDATION_ERROR` | Invalid body/query |
| 401 | `UNAUTHORIZED` | Missing/invalid token |
| 401 | `TOKEN_EXPIRED` | Access token expired |
| 403 | `FORBIDDEN` | No permission |
| 403 | `LICENSE_EXPIRED` | License expired |
| 403 | `LICENSE_REVOKED` | License revoked |
| 403 | `DEVICE_LIMIT_EXCEEDED` | Too many active devices |
| 404 | `NOT_FOUND` | Resource missing |
| 409 | `CONFLICT` | State conflict |
| 409 | `IDEMPOTENCY_REPLAY` | Same idempotency key, same response returned |
| 429 | `RATE_LIMITED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Unexpected server error |

---

## Health

### `GET /health`

- **Auth:** none
- **Response 200:**

```json
{
  "success": true,
  "data": { "status": "ok", "timestamp": "2026-08-30T10:00:00.000Z" },
  "requestId": "..."
}
```

### `GET /health/ready`

- **Auth:** none
- **Response 200:** `{ "status": "ready", "database": "up" }`
- **Response 503:** database unreachable

---

## App configuration

### `GET /app/config`

- **Auth:** none
- **Query:** `platform=android`, `appVersion=1.0.0` (optional)

```json
{
  "success": true,
  "data": {
    "maintenance": { "enabled": false, "message": null },
    "android": {
      "latestVersion": "1.2.0",
      "minimumSupportedVersion": "1.0.0",
      "updateUrl": "https://...",
      "forceUpdate": false,
      "releaseNotes": "..."
    },
    "serverTime": "2026-08-30T10:00:00.000Z"
  }
}
```

---

## Authentication

### `POST /auth/device/register`

First launch or returning installation.

**Body:**

```json
{
  "installationId": "550e8400-e29b-41d4-a716-446655440000",
  "platform": "ANDROID",
  "appVersion": "1.0.0",
  "deviceName": "Samsung Galaxy A54",
  "category": "TEACHER"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| installationId | UUID | yes | RFC 4122 |
| platform | enum | yes | `ANDROID` |
| appVersion | string | yes | semver-like |
| deviceName | string | no | max 120 |
| category | enum | no | UserCategory |

**Response 201:**

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "rt_...",
    "expiresIn": 900,
    "tokenType": "Bearer",
    "user": {
      "id": "usr_...",
      "displayName": null,
      "category": "TEACHER",
      "status": "ACTIVE",
      "createdAt": "2026-08-30T10:00:00.000Z"
    },
    "trial": {
      "active": true,
      "expiresAt": "2026-09-13T10:00:00.000Z"
    }
  }
}
```

### `POST /auth/refresh`

**Body:** `{ "refreshToken": "rt_..." }`

**Response 200:** new token pair (old refresh invalidated)

### `POST /auth/logout`

**Auth:** access token  
**Body:** `{ "refreshToken": "rt_..." }` (optional — revoke specific session)

**Response 204**

### `POST /auth/logout-all`

**Auth:** access token — revokes all refresh tokens for user

---

## Account

### `GET /account`

```json
{
  "success": true,
  "data": {
    "id": "usr_...",
    "displayName": "Али",
    "category": "TEACHER",
    "status": "ACTIVE",
    "telegram": {
      "linked": true,
      "username": "ali_teacher",
      "linkedAt": "2026-08-30T10:00:00.000Z"
    },
    "createdAt": "2026-08-30T10:00:00.000Z",
    "updatedAt": "2026-08-30T10:00:00.000Z"
  }
}
```

### `PATCH /account`

**Body:** `{ "displayName": "...", "category": "LECTURER" }`

---

## Entitlements (primary Android endpoint)

### `GET /me/entitlements`

**Auth:** required

```json
{
  "success": true,
  "data": {
    "effectiveStatus": "ACTIVE",
    "user": {
      "id": "usr_...",
      "category": "TEACHER",
      "status": "ACTIVE"
    },
    "plan": {
      "code": "STANDARD",
      "name": "Standard"
    },
    "license": {
      "id": "lic_...",
      "status": "ACTIVE",
      "startsAt": "2026-08-30T10:00:00.000Z",
      "expiresAt": "2027-08-30T10:00:00.000Z",
      "keyPrefix": "RZNM-ABCD"
    },
    "trial": null,
    "features": {
      "planning_horizon_days": 28,
      "max_devices": 1,
      "cloud_sync": false,
      "advanced_analytics": false
    },
    "devices": {
      "activeCount": 1,
      "limit": 1,
      "currentInstallationActive": true
    },
    "evaluatedAt": "2026-08-30T10:00:00.000Z"
  }
}
```

`effectiveStatus` values: `ACTIVE` | `TRIAL` | `EXPIRED` | `SUSPENDED` | `NONE`

---

## Licenses

### `POST /licenses/activate`

**Headers:** `Idempotency-Key` recommended

**Body:**

```json
{
  "licenseKey": "RZNM-XXXX-XXXX-XXXX-XXXX",
  "installationId": "550e8400-e29b-41d4-a716-446655440000",
  "deviceName": "Samsung Galaxy A54",
  "appVersion": "1.0.0"
}
```

**Response 200:**

```json
{
  "success": true,
  "data": {
    "license": {
      "id": "lic_...",
      "status": "ACTIVE",
      "planCode": "STANDARD",
      "expiresAt": "2027-08-30T10:00:00.000Z",
      "activatedAt": "2026-08-30T10:00:00.000Z"
    },
    "entitlements": { }
  }
}
```

**Errors:** `LICENSE_NOT_FOUND`, `LICENSE_ALREADY_USED`, `LICENSE_EXPIRED`, `LICENSE_REVOKED`, `DEVICE_LIMIT_EXCEEDED`

### `GET /licenses/me`

Summary of current user's license (or `null`).

---

## Devices

### `GET /devices`

List user's device installations.

### `POST /devices/register`

Update `lastSeenAt`, `appVersion`, `deviceName` for current installation.

### `POST /devices/revoke`

**Body:** `{ "deviceId": "dev_..." }` or `{ "installationId": "..." }`

---

## Telegram linking

### `POST /telegram/link/start`

**Response 200:**

```json
{
  "success": true,
  "data": {
    "linkCode": "A7K9M2",
    "expiresAt": "2026-08-30T10:10:00.000Z",
    "botUsername": "RuznamoBot",
    "deepLink": "https://t.me/RuznamoBot?start=link_A7K9M2"
  }
}
```

### `GET /telegram/link/status`

```json
{
  "success": true,
  "data": {
    "linked": true,
    "telegramId": "123456789",
    "username": "ali_teacher",
    "linkedAt": "2026-08-30T10:05:00.000Z"
  }
}
```

---

## Admin API (summary)

Base: `/api/v1/admin`  
Auth: `Bearer <adminAccessToken>` with `aud=admin`

| Method | Path | Permission |
|--------|------|------------|
| POST | `/admin/auth/login` | public |
| GET | `/admin/dashboard/summary` | `dashboard:read` |
| GET | `/admin/users` | `users:read` |
| GET | `/admin/users/:id` | `users:read` |
| PATCH | `/admin/users/:id/suspend` | `users:suspend` |
| PATCH | `/admin/users/:id/activate` | `users:activate` |
| GET | `/admin/licenses` | `licenses:read` |
| POST | `/admin/licenses` | `licenses:create` |
| PATCH | `/admin/licenses/:id/revoke` | `licenses:revoke` |
| PATCH | `/admin/licenses/:id/extend` | `licenses:extend` |
| GET | `/admin/orders` | `orders:read` |
| GET | `/admin/orders/:id` | `orders:read` |
| POST | `/admin/orders/:id/approve` | `orders:approve` |
| POST | `/admin/orders/:id/reject` | `orders:reject` |
| GET | `/admin/audit` | `audit:read` |

### Dashboard summary example

```json
{
  "users": { "total": 1200, "active": 1100, "suspended": 15 },
  "licenses": { "active": 450, "expired": 80, "pending": 12 },
  "orders": { "pending": 5, "underReview": 3 },
  "revenue": { "currency": "TJS", "monthToDate": 6750, "yearToDate": 45000 },
  "recentActivity": []
}
```

---

## OpenAPI

Swagger UI at `/api/docs` (non-production or admin-protected in production).

All DTOs annotated with `@ApiProperty` for Android code generation compatibility.

---

## Versioning

- URL prefix: `/api/v1`
- Breaking changes → `/api/v2`
- Android sends `X-App-Version` header on all requests
