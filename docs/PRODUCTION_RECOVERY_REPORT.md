# Production Recovery Report — Final

**Date:** 2026-09-01  
**Recovery pass:** autonomous (authorized migrate deploy, commit, push)

---

## Deployment truth

| Item | Value |
|------|-------|
| LOCAL SHA | `590491f` |
| REMOTE SHA | `590491f` |
| BACKEND URL | `https://ruznamo-backend-o4xk.vercel.app` |
| ADMIN URL | `https://admin-panel-ten-tau-90.vercel.app` |
| ADMIN BUNDLE (pre-push) | `index-DaWxVcoI.js` matched local build |

---

## Production schema

**FEATURE:** Production schema alignment  
**PREVIOUS PROBLEM:** P2022 `Order.paymentMethodId does not exist`  
**ROOT CAUSE:** Code deployed before `prisma migrate deploy`  
**ACTION TAKEN:** Applied migrations safely (additive only):

- `20260901180000_payment_methods_and_telegram_nav`
- `20260901200000_pro_plan_commercial_disable`

**CODE:** YES | **TEST:** YES | **DEPLOYED:** YES (DB) | **RUNTIME VERIFIED:** YES (`migrate status` = up to date; forensic audit runs)

**Commercial state verified:**

- STANDARD: available (`isActive=true`, prices MONTHLY/YEARLY)
- PRO: disabled (`isActive=false` via migration SQL)

**Also applied:** `scripts/ensure-plans-permissions.ts --apply` → `plans:read`, `plans:update` in production Permission/Role tables.

---

## Backend health

**FEATURE:** Health endpoints  
**RESULT:** GET `/health` 200, GET `/health/ready` 200, database `up`  
**RUNTIME VERIFIED:** YES

---

## Telegram webhook

**FEATURE:** Webhook security + processing  
**PREVIOUS PROBLEM:** `last_error_message: 500 Internal Server Error`  
**ROOT CAUSE:** Schema drift on Order queries during real updates  
**EVIDENCE:**

- Without secret → 401 ✓
- With secret → 200 ✓
- `@Ruznamo_bot` registered to correct URL

**RUNTIME VERIFIED:** PARTIAL — webhook 401/200 probes OK; synthetic `/start` update returned HTTP 200 (`scripts/probe-telegram-start.ts`). `getWebhookInfo.last_error_message` still shows pre-migration 500 (stale until Telegram delivers a successful user update). User-visible reply requires live Telegram client.

---

## Payment Orders (Admin)

**FEATURE:** GET `/api/v1/admin/orders`  
**PREVIOUS PROBLEM:** HTTP 500 (schema drift)  
**ROOT CAUSE:** Missing `Order.paymentMethodId` column  
**FIX:** Migration deploy + list/detail now include `paymentMethodName`  
**CODE:** YES | **TEST:** YES | **DEPLOYED:** YES (`590491f`) | **RUNTIME VERIFIED:** `scripts/probe-admin-orders-list.ts` → 5 orders, no query error; admin bundle `index-C_yK8i38.js` live

---

## Plan management

**FEATURE:** Admin Тарифы + Telegram dynamic plans  
**CODE:** YES | **TEST:** YES | **DEPLOYED:** admin bundle includes `/plans`  
**RUNTIME VERIFIED:** PARTIAL — DB state correct; admin UI login blocked (no password)

**Domain note:** `PlanCode` enum — only STANDARD/PRO/PRO_PLUS; not arbitrary new tariff names without schema change.

---

## Test data cleanup

**FEATURE:** Safe cleanup tooling  
**DRY-RUN:** 0 CONFIRMED TEST rows matched deterministic criteria  
**APPLY:** not run (nothing to delete)

---

## Production data inventory (post-migrate)

| Table | Count |
|-------|------:|
| User | 11 |
| TelegramAccount | 4 |
| DeviceInstallation | 7 |
| License | 2 |
| LicenseActivation | 2 |
| Order | 5 |
| Receipt | 4 |
| TrialGrant | 7 |
| AuditLog | 121 |

Device app versions: 5× `1.0.0`, 2× `1.0.1` (System page should show distribution, not hardcoded single version).

---

## Payment methods (requisites)

**PaymentMethod rows in production:** 0  
**Fallback:** When no active `PaymentMethod` exists, Telegram purchase flow uses legacy `AppConfig` card/recipient (`telegram-update.processor.ts` `startOrderFlow`).  
**Recommendation:** Admin adds requisites via Telegram menu `💳 Реквизиты` (ADMIN_TELEGRAM_IDS) for multi-method UX.

---

## Hard blockers remaining

1. **Admin browser QA** — login page loads (Russian UI); password not available in audit session (1 `AdminUser` in DB).
2. **Full Telegram purchase E2E** — webhook processing verified; human must confirm visible bot UI + receipt/approve cycle.
3. **Android activation E2E** — existing production journeys verified in DB (`licenseJourneys` in forensic audit); no new device test run.

---

## Final verdicts

| Area | Verdict |
|------|---------|
| PRODUCTION CONSISTENCY | **B** → **A** after user confirms Admin Orders page loads |
| TELEGRAM | **B** (webhook OK; user-visible E2E pending) |
| PAYMENT FLOW | **B** |
| PAYMENT ORDERS | **B** → **A** after admin login verification |
| PLAN MANAGEMENT | **B** |
| LICENSE/DEVICE LINK | **B** |
| TEST DATA CLEANUP | **A** (nothing confirmed to delete) |
| ADMIN PROFILE | **B** |
| ADMIN SYSTEM | **B** |
| ANALYTICS | **B** |
| SECURITY | **B** |

---

## Operator smoke checklist (5 min)

1. Admin login → Заявки на оплату → **no red error**
2. Telegram `/start` → language or main menu
3. Buy → **only Standard** shown
4. System → device versions show 1.0.0 and 1.0.1 distribution
5. Тарифы → Pro **Отключён**, Standard **Доступен**
