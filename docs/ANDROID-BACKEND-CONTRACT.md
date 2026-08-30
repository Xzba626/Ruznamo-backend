# Android ↔ Backend Contract Checklist

> Source of truth: `docs/API-CONTRACT.md`  
> Android source is maintained in a separate repository (`D:\Ruznamo`).

## Implementation status

| Contract area | Backend status | Android action |
|---------------|----------------|----------------|
| `POST /api/v1/auth/device/register` | ❌ BLOCK 2 | Send `installationId` UUID v4 |
| `POST /api/v1/auth/refresh` | ❌ BLOCK 2 | Rotate refresh token |
| `GET /api/v1/account` | ❌ BLOCK 2 | Profile sync |
| `GET /api/v1/me/entitlements` | ❌ BLOCK 3 | Primary commercial sync |
| `POST /api/v1/licenses/activate` | ❌ BLOCK 3 | Idempotent activation |
| `GET /api/v1/devices` | ❌ BLOCK 2 | Device list |
| `POST /api/v1/telegram/link/start` | ❌ BLOCK 5 | Telegram linking |
| `GET /api/v1/app/config` | ✅ implemented | Update check, maintenance |
| `GET /health` | ✅ implemented | Liveness |
| `GET /health/ready` | ✅ implemented | Readiness |

## Stable enums (must match Android)

### UserCategory

```
TEACHER | LECTURER | TUTOR | TRAINER | EMPLOYEE | STUDENT | PERSONAL
```

### Response envelope

All API responses:

```json
{
  "success": true,
  "data": {},
  "requestId": "..."
}
```

### Timestamps

ISO 8601 UTC: `2026-08-30T10:00:00.000Z`

## Android responsibilities

- Generate `installationId` as cryptographically random UUID
- Store access/refresh tokens securely (EncryptedSharedPreferences)
- Cache last successful `GET /me/entitlements` for offline UX
- **Never** embed server secrets, license pepper, or bot tokens

## Backend responsibilities

- Source of truth for trial, license, entitlements, device limits
- STANDARD plan only for commercial launch (15/150 TJS)
- Trial: server-side `TrialGrant`, `TRIAL_DURATION_HOURS=24` from SystemConfig

## Before Android integration

- [ ] BLOCK 2 auth deployed and tested
- [ ] BLOCK 3 entitlements + license activation
- [ ] Production `API_BASE_URL` configured in Android
- [ ] Cross-check enum values with Android Room models
