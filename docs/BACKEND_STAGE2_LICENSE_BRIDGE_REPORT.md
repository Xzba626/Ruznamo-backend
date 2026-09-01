# Backend Stage 2 — License Bridge Report

**Repository:** `D:\Ruznamo-Backend`  
**Date:** 2026-09-01  
**Status:** Implemented locally — **not committed, not deployed**

---

## 1. Architecture before

```
Telegram /start → User A (TelegramAccount)
Payment approve → License.userId = User A

Android register → User B (separate)
POST /licenses/activate (JWT User B)
  → if license.userId !== User B → LICENSE_ALREADY_ACTIVATED ❌
```

Telegram purchaser and Android mobile user were **different `User` rows**, but activation required the same `userId`.

---

## 2. Root cause

`PaymentApprovalService` assigns `License.userId = order.userId` (Telegram user).

`LicensesService.activate` rejected any mobile user where `license.userId !== user.sub`.

Result: **Telegram purchase could not be activated on Android**.

---

## 3. Architecture after (no user merge)

```
Telegram User A ──owns──► License (purchaser, userId preserved)
                              │
                              │ license key (bridge)
                              ▼
                    LicenseActivation
                              │
                              ▼
              Device B1 ──► Mobile User B (JWT)
```

- **No** physical merge of `User` records
- **No** transfer of `TelegramAccount`, `Order`, or `TrialGrant`
- Bridge = **`LicenseActivation`** + authenticated mobile JWT + `licenseKey`

---

## 4. Schema changes

**None.** Existing models are sufficient:

| Model | Role |
|-------|------|
| `License.userId` | Telegram purchaser (preserved) |
| `LicenseActivation` | Links license ↔ device |
| `DeviceInstallation.userId` | Mobile session owner |

Unique constraint: `@@unique([licenseId, deviceId])` on `LicenseActivation`.

---

## 5. Endpoint changes

### `POST /api/v1/licenses/activate`

| Aspect | Before | After |
|--------|--------|-------|
| Request body | `{ licenseKey }` | unchanged |
| Cross-user activation | blocked | **allowed** |
| `license.userId` on activate | overwritten to mobile user | **unchanged** (purchaser) |
| Idempotent same device | partial | **200 + audit `license.activation.idempotent`** |
| Race safety | count outside tx | **FOR UPDATE + tx + P2002 handling** |

### `GET /api/v1/me/entitlements`

Resolves license access via:

1. `LicenseActivation` on user's devices (primary bridge path)
2. Direct `user.licenses` (backward compatibility)

### `GET /api/v1/licenses/me`

Returns licenses activated on the mobile user's devices.

### `GET /api/v1/app/config`

Added optional public field: `telegramBotUsername` (from `TELEGRAM_BOT_USERNAME`, no `@`).

---

## 6. License activation flow

1. Authenticate mobile JWT → `User B`, `Device B1`
2. Hash `licenseKey` → find `License`
3. `SELECT … FOR UPDATE` on license row (concurrency)
4. Validate: not revoked, not expired
5. Validate current device active
6. If `LicenseActivation` exists for license+device → **idempotent success**
7. Count activations where `device.revokedAt IS NULL`
8. If count ≥ `plan.max_devices` → `LICENSE_ACTIVATION_LIMIT`
9. Create `LicenseActivation`
10. Return license summary + entitlements

Android sends **only** `licenseKey`. No Telegram ID.

---

## 7. Multi-device policy

Limits from `PlanFeature.max_devices` (seed: STANDARD=1, PRO=2).

| Scenario | Result |
|----------|--------|
| Same device, repeat activate | 200 idempotent |
| PRO: device 1 + device 2 | both OK |
| PRO: device 3 | `LICENSE_ACTIVATION_LIMIT` |
| Revoked device | excluded from active count (`device.revokedAt IS NULL`) |

Device revoke (`POST /devices/revoke`) sets `DeviceInstallation.revokedAt` — activation records remain for audit; slot is freed logically via count filter.

---

## 8. Concurrency / race protection

1. Interactive Prisma `$transaction`
2. `SELECT id FROM "License" WHERE id = ? FOR UPDATE` before count/create
3. Unique `(licenseId, deviceId)` + P2002 → idempotent or limit error
4. All critical queries use transaction client `tx`

---

## 9. Idempotency

Repeated `POST /licenses/activate` with same license + same device:

- No duplicate `LicenseActivation`
- No extra device slot consumed
- Audit: `license.activation.idempotent`
- Returns current license + entitlements

---

## 10. Security decisions

| Rule | Status |
|------|--------|
| No client `userId` / `telegramId` | enforced |
| Identity from JWT only | yes |
| Raw license key not in list APIs | yes |
| `LICENSE_KEY_PEPPER` server-only | unchanged |
| No user merge | enforced |
| Telegram payment flow (BLOCK 5A) | unchanged |

---

## 11. Entitlement selection (multiple licenses)

When multiple active licenses exist, pick by:

1. Active / non-expired
2. Highest plan priority: PRO_PLUS > PRO > STANDARD
3. Latest `expiresAt`

---

## 12. Tests

| Suite | Result |
|-------|--------|
| `licenses.service.spec.ts` | 9 cases (bridge, idempotent, P2002, limits, expired, revoked) |
| `licenses.controller.spec.ts` | delegation |
| `entitlement.service.spec.ts` | activation-based access |
| Full `npm test` | **86/86 passed** |

---

## 13. Build

Run: `npm run build` — **passed**

---

## 14. Known limitations

1. **Admin Panel** — license shown on Telegram User A; mobile User B visible via device/activation — unified user view may need future admin API work.
2. **Production deploy** — not performed; requires commit + Vercel redeploy.
3. **E2E with real Telegram** — not run in CI; manual checklist required.
4. **`LICENSE_ALREADY_ACTIVATED`** — removed from cross-identity path; documented in contract v2.

---

## 15. Android contract

Authoritative document: [`docs/MOBILE-API-CONTRACT-v2.md`](./MOBILE-API-CONTRACT-v2.md)

**Activate request:**

```http
POST /api/v1/licenses/activate
Authorization: Bearer <mobile JWT>

{ "licenseKey": "..." }
```

**Key errors:** `LICENSE_INVALID`, `LICENSE_REVOKED`, `LICENSE_EXPIRED`, `LICENSE_ACTIVATION_LIMIT`, `DEVICE_REVOKED`

---

## 16. Files changed

| File | Change |
|------|--------|
| `src/licenses/licenses.service.ts` | bridge activation, FOR UPDATE, P2002, idempotent audit |
| `src/entitlements/entitlement.service.ts` | entitlements via `LicenseActivation` |
| `src/licenses/licenses.service.spec.ts` | expanded tests |
| `src/licenses/licenses.controller.spec.ts` | new |
| `src/entitlements/entitlement.service.spec.ts` | activation path |
| `src/app-config/app-config.service.ts` | `telegramBotUsername` |
| `src/app-config/dto/app-config.dto.ts` | response field |
| `src/app-config/app-config.service.spec.ts` | bot username test |
| `admin-panel/src/i18n/audit.ts` | idempotent audit label |
| `docs/MOBILE-API-CONTRACT-v2.md` | authoritative API contract |

---

## 17. No commit / no push

Confirmed: changes are local only.

---

## E2E manual checklist

- [ ] Telegram purchase → license created for Telegram user
- [ ] Android `device/register` → real device in admin
- [ ] Android activate key → 200, entitlements `access: true`
- [ ] Second phone + PRO key → second activation OK
- [ ] Third device → `LICENSE_ACTIVATION_LIMIT`
- [ ] Repeat activate same device → 200 idempotent
- [ ] `GET /app/config` → `telegramBotUsername` populated in production env
