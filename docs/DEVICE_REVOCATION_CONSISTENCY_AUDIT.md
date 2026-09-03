# Device Revocation Consistency — Forensic Report

Date: 2026-09-03  
Repository: `D:\Ruznamo-Backend`

## ROOT CAUSE

**Primary:** `EntitlementService.getSnapshot()` granted `access: true` when the mobile user **owned** an active `License` (`License.userId`), even if the **current** `DeviceInstallation` had no active activation or was **revoked**. Android gated on `access`, so a holder-revoked device kept showing Pro until token expiry / offline cache.

**Secondary:**

1. Telegram holder revoke set only `DeviceInstallation.revokedAt` and did **not** revoke `RefreshToken` rows (user self-revoke did).
2. `POST /auth/device/register` and refresh **blocked** revoked installations entirely → after session loss, user saw **"Mobile Authentication Required"** instead of a recovery path.
3. `POST /auth/telegram/challenge` required `revokedAt: null` for **all** purposes including `RECOVERY`.

License and activation counting (X/Y in Telegram) was already correct (`activations.filter(!device.revokedAt)`).

---

## TELEGRAM REVOKE MUTATIONS

### BEFORE

| Entity | Mutation |
|--------|----------|
| `DeviceInstallation.revokedAt` | SET |
| `LicenseEvent` | INSERT (`holder_device_revoked`) |
| `AuditLog` | INSERT |
| `RefreshToken` | **unchanged** |
| `LicenseActivation` | **unchanged** (filtered at read via device.revokedAt) |
| `License.status` | **unchanged** |

### AFTER

| Entity | Mutation |
|--------|----------|
| `DeviceInstallation.revokedAt` | SET |
| `RefreshToken` (device) | **revoked in same transaction** |
| `LicenseEvent` | INSERT |
| `AuditLog` | INSERT (includes before/after slot counts) |
| `LicenseActivation` | unchanged (by design — slot inactive via device.revokedAt) |
| `License.status` | unchanged |

Shared helper: `src/devices/revoke-device-installation.ts` (also used by admin revoke + user self-revoke).

---

## CODE CHANGES

| Area | Change |
|------|--------|
| `entitlement.service.ts` | `access` requires active activation on **current** installation; revoked installation always denied; license metadata preserved |
| `telegram-license-link.service.ts` | Atomic revoke + refresh invalidation; returns `{ devicesUsedBefore, devicesUsedAfter, deviceLimit }` |
| `auth.service.ts` | Revoked device may re-authenticate (limited session); refresh allowed on revoked device |
| `telegram-auth.service.ts` | `RECOVERY` / `LOGIN` / `KEY_REVEAL` / `DEVICE_REPLACEMENT` allowed on revoked device; `LINK_ACCOUNT` still requires active slot |
| Telegram bot | Shows **Было: X из Y / Стало: Z из Y** (RU/TJ) after holder revoke |

---

## ACCEPTANCE CHECKLIST

| Check | Result | Notes |
|-------|--------|-------|
| ACTIVE COUNT | **PASS** | Count uses `device.revokedAt null` only |
| REVOKED ENTITLEMENT | **PASS** | `/me/entitlements` → `access: false`, license info may remain |
| LICENSE PRESERVED | **PASS** | Holder revoke does not change `License.status` |
| RECOVERY FROM REVOKED DEVICE | **PASS** | Re-auth + RECOVERY challenge on revoked installation |
| SECURITY | **PASS** | Holder verification unchanged; OTP/challenge binding preserved; LINK_ACCOUNT still requires active slot |
| PRODUCTION DATA RESET | **NO** | |

---

## TESTS

**186 / 186** Jest tests PASS (includes new entitlement, auth, telegram-auth, holder-revoke specs).

---

## PRODUCTION RUNTIME ACCEPTANCE

**Not executed in this session** — requires deploy + physical device with holder revoke scenario.

Expected after deploy:

1. Telegram revoke Huawei → **1/2**
2. Huawei online → next entitlements sync → **access denied**, license gate
3. **Recover access** → challenge succeeds (not blocked by revoked slot)
4. Second non-revoked device → remains entitled

---

## MOBILE CLIENT NOTE

If Android caches entitlements offline, it should treat `access: false` or `currentInstallationActive: false` as license gate. Backend now returns correct online authority immediately after sync.
