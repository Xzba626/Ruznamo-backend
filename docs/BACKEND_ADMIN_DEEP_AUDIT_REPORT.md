# Backend + Admin Deep Audit Report

**Date:** 2026-09-01  
**Repository:** `D:\Ruznamo-Backend`  
**Mode:** Forensic audit + targeted fixes (no production DB mutation, no deploy)

---

## Executive Summary

This audit addressed admin observability gaps, Payment Orders failure, unified license journey visibility, system version accuracy, analytics, and admin profile editing — **without merging Telegram and mobile `User` records**.

**Tests:** 117/117 backend Jest tests PASS  
**Build:** backend `nest build` PASS, admin-panel `tsc + vite build` PASS

**DB note:** Live Neon inventory could not be completed from the audit environment (connection timeout). Re-run `scripts/forensic-data-audit.ts` from a connected environment before cleanup approval.

---

## 1. Architecture Map

```
TelegramAccount (BigInt telegramId)
    ↓ userId
User A (Telegram purchaser)
    ↓
Order → Receipt(s)
    ↓
License (userId = User A, orderId)
    ↓
LicenseActivation
    ↓
DeviceInstallation (userId = User B, mobile)
    ↓
User B (Android/mobile account)
```

**Design intent:** Telegram purchaser and mobile activator **may be different `User` rows**. This is valid. Admin must show a **linked journey** without forcing `User` merge.

---

## 2. Production Data Inventory

Use `scripts/forensic-data-audit.ts` for live counts. Schema tables audited:

| Model | Role |
|-------|------|
| User | Mobile + Telegram identities |
| TelegramAccount | Telegram linkage |
| Order / Receipt | Payment flow |
| License / LicenseActivation | Entitlements |
| DeviceInstallation | Android telemetry (`appVersion`, `lastSeenAt`) |
| TrialGrant | Trial state |
| AdminUser / AdminTelegramIdentity | Admin auth |
| AuditLog | Security/product events |
| AppVersion | Configured Android release metadata |

---

## 3. Test / Demo Classification

Heuristic script flags (see `PRODUCTION_DATA_CLEANUP_PLAN.md`):

- Test emails (`@example.com`, `test@`, etc.)
- Emulator device names / `test-` installation IDs
- Audit actions with `.test.` pattern

**No rows deleted.** Cleanup script: `scripts/cleanup-confirmed-test-data.ts` (dry-run default).

---

## 4. Telegram → License → Activation Trace

**Backend activation flow** (`POST /api/v1/licenses/activate`):

1. Lookup license by `keyHash`
2. Validate status/expiry
3. Resolve current device from JWT (`user.deviceId`)
4. Idempotent if same `licenseId + deviceId`
5. Enforce `max_devices` from plan features
6. **Creates `LicenseActivation`** (does not overwrite `License.userId`)
7. Sets license ACTIVE, writes `LicenseEvent` with `purchaserUserId` + `mobileUserId` metadata

**Verdict:** Implementation is correct at domain layer. Live DB trace pending connectivity.

---

## 5. Unified Customer / License Journey (Admin)

**Implemented:** `GET /api/v1/admin/orders/:id` returns:

- Payment (order status, amount, plan, dates)
- Telegram purchaser (`serializeOrderUser` — BigInt-safe)
- License (prefix only, no raw key)
- Activations with device + **mobile user** reference

**Admin UI:** Orders page detail panel shows full chain in Russian.

---

## 6. Payment Orders — Root Cause (P1)

**Symptom:** Admin «Заявки на оплату» → Internal Server Error

**Root cause:** `TelegramAccount.telegramId` is `BigInt`. NestJS `JSON.stringify` throws:

`TypeError: Do not know how to serialize a BigInt`

when orders list returned raw Prisma objects.

**Fixes applied:**

1. `serializeOrderUser()` in list/detail (`src/admin/common/serialize-user.ts`)
2. Global `BigIntSerializationInterceptor` as safety net (`src/common/interceptors/`)
3. Unit test for orders list BigInt serialization

**Secondary bug fixed:** order detail used `device_limit` feature key; schema/seed uses `max_devices` → `readMaxDevicesFromFeatures()` helper.

---

## 7. System Page — Data Sources

| Display | Source |
|---------|--------|
| Backend version | `package.json` version (`0.1.0`) |
| Build ID | `VERCEL_GIT_COMMIT_SHA` when deployed |
| DB health | Terminus Prisma ping |
| Migration count | `_prisma_migrations` |
| Android «latest» | `AppVersion` table (seed default `1.0.0`) |
| **Real device versions** | `DeviceInstallation.appVersion` aggregation |
| Telegram webhook | Live `getWebhookInfo` probe (no secrets exposed) |

**Version mismatch explained:** Admin previously showed hardcoded `1.0.0`. Phones reporting `1.0.1` come from **device telemetry**, not `AppVersion`. System page now shows both configured release metadata and actual device distribution.

---

## 8. Analytics

**New/registered:** `GET /api/v1/admin/analytics/overview`

Aggregate-only metrics:
- Devices (total + active 30d via `lastSeenAt`)
- Trials, active licenses, paid users
- Category / plan / app version distributions
- 30-day trends (installations, activations, orders)

**Privacy:** No message content, no PII export. Uses existing operational data.

**Admin UI:** `/analytics` page (Russian).

---

## 9. Admin Profile

**Root cause:** `displayName` was read-only in UI; no `PATCH` endpoint existed (DTO file was orphaned).

**Fix:** `PATCH /api/v1/admin/auth/me` with `AdminUpdateProfileDto`, audit event `admin.profile.updated`, Profile page edit form.

Login email (`username`) remains separate and non-editable from self-profile.

---

## 10. Security Findings

| Area | Status |
|------|--------|
| Admin JWT + permissions guards | OK |
| Orders/license APIs permission-gated | OK |
| No raw license key in admin APIs | OK (prefix only) |
| Telegram secrets masked in system endpoints | OK |
| Profile update scoped to current admin | OK |
| Cleanup script requires explicit `--apply` | OK |
| BigInt leakage via JSON | **Fixed** |

No IDOR issues found in reviewed admin routes (scoped by admin auth).

---

## 11. Tests Added

- `bigint-serialization.interceptor.spec.ts`
- `plan-features.util.spec.ts`
- `admin-analytics.service.spec.ts`
- Orders list BigInt serialization test
- Admin profile `updateProfile` test

---

## 12. Deployment Requirements

To fix production admin errors, deploy:

1. Backend with BigInt interceptor + orders serialization + analytics module registration + system service + profile PATCH
2. Admin panel with Orders detail, System cards, Analytics, Profile edit

**No DB migration required** for these fixes.

Optional: Update `AppVersion.latestVersion` to match released APK when publishing.

---

## 13. Remaining Issues

| Priority | Issue |
|----------|-------|
| P1 | Live DB license journey trace (needs DB connectivity) |
| P1 | Production deploy of fixes |
| P2 | `AppVersion` seed still `1.0.0` — update via admin config or seed after release |
| P2 | Dashboard could link to Analytics |
| P3 | Order detail could use modal instead of inline panel |
| P3 | Licenses admin list could include order/activation journey link |

---

## Final Verdicts

| Area | Grade | Notes |
|------|-------|-------|
| **DATA INTEGRITY** | **B** | Schema sound; live inventory pending DB access |
| **LICENSE / DEVICE LINK** | **B** | Code path correct; live trace not verified in DB |
| **PAYMENT ORDERS** | **B** | Root cause fixed in code; needs deploy |
| **ADMIN SYSTEM** | **B** | Real observability implemented |
| **ANALYTICS** | **B** | Aggregate API + UI added |
| **ADMIN PROFILE** | **A** | Backend PATCH + UI wired + tests |
| **TEST DATA CLEANUP** | **C** | Script + plan only; no `--apply` |

---

## Files Changed (summary)

**Backend**
- `src/common/interceptors/bigint-serialization.interceptor.ts`
- `src/admin/common/serialize-user.ts`, `plan-features.util.ts`
- `src/admin/orders/admin-orders.service.ts`
- `src/admin/system/admin-system.service.ts`
- `src/admin/analytics/*` (registered in `admin.module.ts`)
- `src/admin/auth/*` (PATCH profile)
- `scripts/forensic-data-audit.ts`, `scripts/cleanup-confirmed-test-data.ts`

**Admin panel**
- `OrdersPage`, `SystemPage`, `AnalyticsPage`, `ProfilePage`
- `api/admin.ts`, `api/auth.ts`, `i18n/*`, `styles.css`
