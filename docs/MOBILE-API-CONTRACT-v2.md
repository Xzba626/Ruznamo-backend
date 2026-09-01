# Ruznamo Mobile API Contract v2

**Authoritative source:** backend implementation in `src/` (this document reflects Backend Stage 2).

**Production base URL:** `https://ruznamo-backend-o4xk.vercel.app`

**Audience:** Android client, backend engineers, integration QA.

---

## Architecture: license key as bridge

Telegram identity and Android mobile identity are **separate** `User` records. They are linked **only through the license key** and `LicenseActivation` rows — there is **no user merge**.

```
TelegramAccount → User A (purchaser)
                        ↓
                     License ←── license key
                        ↓
              LicenseActivation
                        ↓
              DeviceInstallation → User B (mobile session)
```

- **User A** — created when a Telegram user interacts with the bot; owns `Order` and `License.userId` (purchaser).
- **User B** — created on `POST /auth/device/register` from Android; owns mobile JWT, sessions, and local device rows.
- **License key** — proves the mobile user may attach their device to the purchaser's license.
- **LicenseActivation** — binds `licenseId` + `deviceId` (unique); enforces `max_devices` from plan.

---

## Authentication

| Item | Value |
|------|-------|
| Mobile JWT audience | `ruznamo-mobile` |
| Access token TTL | `15m` (configurable) |
| Refresh token TTL | `30d` (configurable) |
| JWT claims | `sub` (userId), `deviceId`, `installationId`, `type: "access"` |

Android must send:

```http
Authorization: Bearer <accessToken>
```

---

## Endpoints

### 1. App config

```http
GET /api/v1/app/config?platform=ANDROID&appVersion=1.0.0
```

**Auth:** none

**Response (200):** maintenance flags, Android version policy, announcement, `serverTime`, `telegramBotUsername` (nullable, no `@`).

> `botUsername` is exposed as `telegramBotUsername` (no `@` prefix). If null, Android may fall back to `BuildConfig`.

---

### 2. Device-first registration (first launch)

```http
POST /api/v1/auth/device/register
```

**Auth:** none

**Request:**

```json
{
  "installationId": "550e8400-e29b-41d4-a716-446655440000",
  "platform": "ANDROID",
  "appVersion": "1.0.0",
  "deviceName": "Samsung Galaxy S24",
  "category": "TEACHER"
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `installationId` | yes | UUID v4, stable per install |
| `platform` | yes | `ANDROID` |
| `appVersion` | yes | semver string, max 32 chars |
| `deviceName` | no | max 120 chars |
| `category` | no | `UserCategory` enum |

**Response (201):**

```json
{
  "success": true,
  "data": {
    "tokens": {
      "accessToken": "...",
      "refreshToken": "...",
      "expiresIn": 900,
      "tokenType": "Bearer"
    },
    "user": { "id": "...", "displayName": null, "category": "PERSONAL", "status": "ACTIVE", "createdAt": "..." },
    "device": { "id": "...", "installationId": "...", "status": "ACTIVE" },
    "trial": { "status": "ACTIVE", "expiresAt": "..." }
  }
}
```

**Behavior:**

- Same `installationId` → session restore (updates metadata, issues new tokens).
- New `installationId` → new `User` + `DeviceInstallation` + `TrialGrant`.

**Errors:**

| Code | HTTP | When |
|------|------|------|
| `MAINTENANCE_MODE` | 503 | maintenance enabled |
| `DEVICE_REVOKED` | 403 | installation revoked |
| `USER_SUSPENDED` | 403 | account suspended |
| `USER_DELETED` | 403 | account deleted |

---

### 3. Token refresh

```http
POST /api/v1/auth/refresh
```

**Request:** `{ "refreshToken": "..." }`

**Response (200):** `{ "tokens": { ... } }`

**Errors:** `INVALID_REFRESH_TOKEN`, `REFRESH_TOKEN_EXPIRED`, `DEVICE_REVOKED`

---

### 4. Logout

```http
POST /api/v1/auth/logout
POST /api/v1/auth/logout-all
```

**Auth:** JWT (+ optional `refreshToken` body for single logout)

---

### 5. Entitlements

```http
GET /api/v1/me/entitlements
```

**Auth:** JWT

**Response (200):**

```json
{
  "success": true,
  "data": {
    "access": true,
    "source": "LICENSE",
    "effectiveStatus": "ACTIVE",
    "plan": { "code": "PRO", "name": "Pro" },
    "trial": null,
    "license": {
      "id": "...",
      "status": "ACTIVE",
      "keyPrefix": "abcd1234",
      "startsAt": "...",
      "expiresAt": "..."
    },
    "devices": {
      "active": 1,
      "max": 2,
      "currentInstallationActive": true
    },
    "features": {
      "planning_horizon_days": 90,
      "max_devices": 2,
      "cloud_sync": true,
      "advanced_analytics": true
    },
    "evaluatedAt": "..."
  }
}
```

**License access resolution (Stage 2):**

1. Licenses activated on any of the mobile user's devices (`LicenseActivation`).
2. Licenses owned directly by `userId` (legacy / direct assignment).

`devices.active` for licensed users = **global activation count on the effective license** (not mobile user's device count).

`devices.currentInstallationActive` = current JWT `installationId` has a `LicenseActivation` on the effective license.

---

### 6. License activation

```http
POST /api/v1/licenses/activate
```

**Auth:** JWT required

**Request:**

```json
{
  "licenseKey": "64-char-hex-key-from-telegram"
}
```

Android must **not** send `userId`, `telegramId`, or `installationId` in the body — identity comes from JWT.

**Response (200):**

```json
{
  "success": true,
  "data": {
    "license": {
      "id": "...",
      "status": "ACTIVE",
      "keyPrefix": "abcd1234",
      "plan": { "code": "PRO", "name": "Pro" },
      "startsAt": "...",
      "expiresAt": "...",
      "activatedAt": "..."
    },
    "entitlements": { "...": "same shape as GET /me/entitlements" }
  }
}
```

**Algorithm (server):**

1. Authenticate JWT → mobile `User B`, `Device B1`.
2. Find `License` by hashed key.
3. Validate status / expiry / revocation.
4. If `LicenseActivation` already exists for this license + device → **200 idempotent** (`license.activation.duplicate` audit).
5. Count active activations (`device.revokedAt IS NULL`) inside transaction.
6. If count ≥ `plan.max_devices` → `LICENSE_ACTIVATION_LIMIT`.
7. Create `LicenseActivation`; do **not** change `License.userId` (stays Telegram purchaser).

**Errors:**

| Code | HTTP | When |
|------|------|------|
| `LICENSE_INVALID` | 404 | unknown key |
| `LICENSE_REVOKED` | 403 | revoked |
| `LICENSE_EXPIRED` | 403 | expired |
| `LICENSE_ACTIVATION_LIMIT` | 403 | device slots full on this license |
| `DEVICE_REVOKED` | 403 | current device inactive |
| `PLAN_MISCONFIGURED` | 400 | plan missing `max_devices` |

> **`LICENSE_ALREADY_ACTIVATED` removed** in v2 for cross-identity activation. The license key is the bridge.

---

### 7. My licenses

```http
GET /api/v1/licenses/me
```

**Auth:** JWT

Returns licenses where the mobile user has at least one device activation.

---

### 8. Devices

#### List

```http
GET /api/v1/devices
```

**Auth:** JWT

**Response:**

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "...",
        "installationId": "...",
        "deviceName": "Samsung Galaxy S24",
        "platform": "ANDROID",
        "appVersion": "1.0.0",
        "status": "ACTIVE",
        "lastSeenAt": "...",
        "createdAt": "..."
      }
    ]
  }
}
```

#### Register additional device (same mobile user)

```http
POST /api/v1/devices/register
```

**Auth:** JWT

**Request:** same shape as device metadata (`installationId`, `platform`, `appVersion`, `deviceName?`).

**Errors:** `INSTALLATION_IN_USE`, `DEVICE_REVOKED`, `DEVICE_LIMIT_REACHED`

#### Revoke

```http
POST /api/v1/devices/revoke
```

**Request:** `{ "deviceId": "..." }`

---

## Plan device limits (seed defaults)

| Plan | `max_devices` |
|------|---------------|
| STANDARD | 1 |
| PRO | 2 |
| PRO_PLUS | (inactive) |

Enforced at:

- `POST /licenses/activate` — global activations per license
- `POST /devices/register` — devices per mobile user account vs plan max

---

## Telegram purchase flow (unchanged BLOCK 5A)

```
/start → plan → order → receipt → admin approve
  → PaymentApprovalService creates License (userId = Telegram User A)
  → license key delivered via Telegram bot
```

Android user enters key → `POST /licenses/activate` → `LicenseActivation` on mobile device.

---

## E2E acceptance checklist

- [ ] Android `device/register` → real device in Admin Panel
- [ ] Telegram purchase → license created for Telegram user
- [ ] Android enters key → `200`, entitlements `access: true`
- [ ] Second device + same key on PRO → second activation OK
- [ ] Third device → `LICENSE_ACTIVATION_LIMIT`
- [ ] Repeat activate on same device → `200` idempotent
- [ ] Admin Panel shows Telegram user with license; mobile device visible via activation

---

## Changelog from v1

| Area | v1 | v2 |
|------|----|----|
| Cross-user activation | `LICENSE_ALREADY_ACTIVATED` if `license.userId ≠ mobile user` | Allowed via license key bridge |
| `license.userId` on activate | Overwritten to mobile user | Unchanged (Telegram purchaser) |
| Entitlements | `user.licenses` only | + `LicenseActivation` on user's devices |
| Idempotent activate | partial | explicit duplicate handling |
| Race safety | count outside transaction | count inside `$transaction` |

---

## Android integration notes

1. Persist `installationId`, tokens separately from local schedules/settings.
2. On `401` → refresh once → retry; on refresh failure clear **tokens only**.
3. Map error codes to Tajik UI strings client-side.
4. After successful activate → refresh entitlements + devices list.
5. Telegram button → `Intent.ACTION_VIEW` → `https://t.me/{TELEGRAM_BOT_USERNAME}`.
