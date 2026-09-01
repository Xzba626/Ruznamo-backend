# Production Recovery Report — Final

**Date:** 2026-09-01  
**Recovery pass:** autonomous (authorized migrate deploy, commit, push)

---

## Deployment truth

| Item | Value |
|------|-------|
| LOCAL SHA | `fc64095` → **new commit after this push** |
| REMOTE SHA (pre-push) | `fc64095` |
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

**RUNTIME VERIFIED:** PARTIAL — webhook accepts updates; full user-visible reply requires live Telegram client (not automated here).

---

## Payment Orders (Admin)

**FEATURE:** GET `/api/v1/admin/orders`  
**PREVIOUS PROBLEM:** HTTP 500 (schema drift)  
**ROOT CAUSE:** Missing `Order.paymentMethodId` column  
**FIX:** Migration deploy + list/detail now include `paymentMethodName`  
**CODE:** YES | **TEST:** YES | **DEPLOYED:** pending push | **RUNTIME VERIFIED:** forensic `order.findMany` succeeded post-migrate

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

## Hard blockers remaining

1. **Admin browser QA** — credentials not available in audit session (`xzba626@gmail.com` exists; password required).
2. **Full Telegram E2E** — requires human Telegram client to confirm visible bot replies.
3. **Android activation E2E** — requires device or test key (not run).

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
