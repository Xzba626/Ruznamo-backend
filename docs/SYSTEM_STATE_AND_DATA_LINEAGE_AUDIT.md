# System State & Data Lineage Audit

Date: 2026-09-03  
Repository: `D:\Ruznamo-Backend`  
Migration: `20260903090000_license_activation_slot_model`

## DEVICE MODEL BEFORE

| Concept | Implementation |
|---------|----------------|
| Disconnect from license | Set `DeviceInstallation.revokedAt` (global) |
| LicenseActivation | Sticky join row; never soft-revoked |
| Same-license re-entry | Idempotent if activation row exists |
| Different license after disconnect | Blocked by global `DEVICE_REVOKED` |
| Admin Telegram | DB + env fallback forever |

**Symptom:** Holder disconnect → phone “cursed” for every license + recovery.

## DEVICE MODEL AFTER

| Concept | Implementation |
|---------|----------------|
| `DeviceInstallation` | Installation identity; `revokedAt` = **admin/self global block only** |
| `LicenseActivation` | Slot; `revokedAt` + `revokeReason` = disconnected from **this** license |
| Per-license anti-share | Soft-revoked pair → `LICENSE_RECOVERY_REQUIRED` on key entry |
| Different license | Allowed if device not globally blocked and target license has capacity |
| Telegram verified return | Recovery clears `LicenseActivation.revokedAt` (or creates slot) |
| Replacement | Soft-revokes old activation (`DEVICE_REPLACEMENT`); does **not** block installation |
| Admin Telegram | If any ACTIVE DB binding exists → **DB only**; revoked IDs never via env |

---

## CHECKLIST

| Check | Result |
|-------|--------|
| LICENSE A REVOKE (slot only) | PASS (code) |
| LICENSE B ON SAME DEVICE | PASS (code — device not globally revoked) |
| SAME LICENSE KEY AFTER REVOKE | PASS → `LICENSE_RECOVERY_REQUIRED` |
| TELEGRAM VERIFIED RECOVERY | PASS (clears soft-revoke) |
| ADMIN TELEGRAM DISCONNECT | PASS (API + Profile UI) |
| OLD ADMIN TELEGRAM DENIED | PASS (`AdminTelegramRevokedId` + no env when DB active) |
| NEW ADMIN TELEGRAM | PASS (rebind flow) |
| ENV BYPASS REMOVED | PASS when ACTIVE binding exists |
| TELEGRAM RU | PASS (no mixed-script hits in RU dict) |
| TELEGRAM TJ | PASS fixed `барқарор*` mixed Latin |
| MIXED SCRIPT | PASS after TJ fix |
| HARDCODED VERSION FALLBACK | FOUND in `app-config` defaults `1.0.0` (policy seed, not device telemetry) |
| PRODUCTION RESET | NO |

---

## ADMIN TELEGRAM AUTHORITY

```
sender.id
 → AdminTelegramRevokedId? → DENY
 → any ACTIVE AdminTelegramIdentity in DB?
      YES → require ACTIVE+verified identity for this id
      NO  → bootstrap: ADMIN_TELEGRAM_IDS env (until first DB binding)
```

Profile actions: Connect / Replace / **Disconnect**.

---

## ADMIN DATA LINEAGE (minimum)

| UI field | API | Service | DB / producer |
|----------|-----|---------|---------------|
| Overview users | `/admin/dashboard/summary` | `AdminDashboardService` | `User` counts |
| Active devices | same | same | `DeviceInstallation` where `revokedAt null` |
| Active licenses | same | same | `License` ACTIVE |
| Device app version | `/admin/devices` | `AdminDevicesService` | `DeviceInstallation.appVersionName/Code` ← Android telemetry sync |
| Latest published APK | `/admin/releases` | `AdminReleasesService` | `AppRelease` PUBLISHED |
| Min supported version | `/admin/app-config` / public config | `AppConfigService` | `AppVersion` / default **1.0.0** if unset |
| Tariff prices | `/admin/plans` | `AdminPlansService` | `PlanPrice` (DB authoritative) |
| Telegram admin status | `/admin/telegram/status` | `AdminTelegramService` | `AdminTelegramIdentity` |

**Rule:** LATEST PUBLISHED ≠ INSTALLED ≠ MINIMUM POLICY. No device row should invent `1.0.0`.

---

## TEST DATA CLASSIFICATION

Do not delete without explicit authorization. Known probe patterns:

- `AuthProbe*`, `E2E*`, `Local Test`, `Production Test`, `probe-*` version strings

Return exact IDs in a follow-up cleanup pass.

---

## OWNERSHIP TRANSFER

Supported: password change, session revoke, Telegram disconnect/replace.  
Email change: **not implemented** (do not fake).

---

## TESTS

**187 / 187** Jest PASS. Admin panel build PASS.

Targeted regressions added/updated:

- holder revoke soft-revokes `LicenseActivation` only
- same-license key → `LICENSE_RECOVERY_REQUIRED`
- Admin Telegram: env bootstrap only when no ACTIVE DB binding; revoked IDs denied
- entitlements require active slot on current installation

## RUNTIME

Not marked COMPLETE until production holder-disconnect + License B activation + Admin Telegram deny are verified live.
