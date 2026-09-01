# Plan Availability — Admin Management Report

**Date:** 2026-09-01  
**Repository:** Ruznamo-Backend  
**Verdict:** **B** — code/tests/build ready; production E2E required for **A**

---

## Previous architecture

| Layer | Before |
|-------|--------|
| **Schema** | `Plan` model with `isActive` already existed |
| **Seed** | STANDARD and PRO both `isActive: true` |
| **PaymentConfigService** | `listActivePlanPrices()` filtered by `isActive`; `getPlanPrice()` did **not** check availability |
| **Telegram** | Hardcoded `[Standard]` + `[Pro]` buttons in `planSelectionKeyboard()` |
| **Admin Panel** | No tariffs UI; no API to toggle plans |
| **Android** | `GET /api/v1/app/config` — no plan purchase UI; license key activation only |

**Actual source of truth:** `Plan.isActive` in PostgreSQL, but **not enforced end-to-end** until this block.

---

## DB / schema change

**No new columns.** `Plan.isActive` is the commercial availability flag.

**Migration:** `20260901200000_pro_plan_commercial_disable`

```sql
UPDATE "Plan" SET "isActive" = false WHERE "code" = 'PRO';
```

**Seed default:** PRO `isActive: false`, STANDARD `isActive: true`.

**New permissions:** `plans:read`, `plans:update` (granted to SUPER_ADMIN and ADMIN).

---

## Backend API

| Endpoint | Permission | Purpose |
|----------|------------|---------|
| `GET /api/v1/admin/plans` | `plans:read` | List STANDARD/PRO with prices, license/order counts |
| `PATCH /api/v1/admin/plans/:code` | `plans:update` | Toggle `isActive`, update prices |

**Audit events:**

- `plan.purchaseAvailability.changed` — plan, previousValue, newValue, admin actor
- `plan.prices.updated` — plan, price changes

**Services:**

- `PaymentConfigService.listPurchaseAvailablePlans()` — active STANDARD/PRO with active prices
- `PaymentConfigService.isPlanAvailableForPurchase()`
- `PaymentConfigService.getPlanPriceForPurchase()` — throws if disabled
- `OrderService.findOrCreatePendingOrder()` — blocks **new** orders for disabled plans; reuses existing PENDING

---

## Admin UI

**Page:** `/plans` — «Тарифы»

Each card shows:

- Название (Стандарт / Про)
- Статус продажи: **Доступен для покупки** / **Отключён**
- Цена 30 / 365 дней
- License / order counts
- Toggle + price edit (requires `plans:update`)

**Dashboard:** compact plan status + link to Тарифы.

---

## Telegram integration

- `planSelectionKeyboard()` reads `listPurchaseAvailablePlans()` — **no hardcoded plan buttons**
- Dynamic `choosePlan` text (no plural assumptions)
- Zero active plans → `purchaseUnavailable` + persistent main menu
- Stale `plan:PRO` callback → `planUnavailable`, no Order created
- Duration callback also validates availability before `startOrderFlow`

**Current production intent:**

- STANDARD = ON → visible
- PRO = OFF → hidden from purchase flow

---

## Disabled callback protection

Hiding inline buttons is insufficient. Server-side checks:

1. `parsePlanCallback` → plan selection handler → `isPlanAvailableForPurchase`
2. `parseDurationCallback` → `startOrderFlow` → `getPlanPriceForPurchase` / `findOrCreatePendingOrder`

---

## Existing licenses

Disabling Pro **does not**:

- Revoke Pro licenses
- Change `expiresAt`
- Delete orders or license history

Commercial availability ≠ entitlement.

---

## Pending-order policy

| Scenario | Behavior |
|----------|----------|
| User has PENDING order (same plan+period), admin disables plan | Order **preserved**; user can continue payment/receipt |
| User clicks stale disabled plan callback | Rejected with localized message |
| User starts **new** purchase for disabled plan | `BadRequestException` — no Order |
| User switches plan/duration | `cancelStalePendingPurchases` cancels only **other** pending orders (different plan or period) |

Orders retain immutable snapshot: `planId`, `billingPeriod`, `amount` at creation.

---

## Future new plans (honest assessment)

**Current block (Level A):** enable/disable **existing** `PlanCode` enum values STANDARD | PRO.

**Level B (future):** fully dynamic catalog would require moving beyond strict `PlanCode` enum — not done in this block to avoid risky domain rewrite.

`PRO_PLUS` exists in schema but is excluded from purchasable set (`plan-availability.util.ts`).

---

## Android impact

No change required. Android activates license keys; does not offer plan purchase UI.

---

## Tests

| Test file | Coverage |
|-----------|----------|
| `payment-config.service.spec.ts` | Active plan list, Standard ON/Pro OFF, disabled purchase rejection |
| `admin-plans.service.spec.ts` | List, toggle + audit, unknown plan rejection |
| `order.service.spec.ts` | Disabled plan blocks new order; pending-order cancel policy |
| `plan-callback.spec.ts` | Callback parsing, PRO_PLUS rejected |

---

## Production actions required

1. `prisma migrate deploy` (includes `pro_plan_commercial_disable`)
2. Re-seed or run migration to ensure PRO `isActive=false`
3. Grant `plans:read` / `plans:update` to existing ADMIN roles (re-run seed or manual SQL on `RolePermission`)
4. Telegram E2E:
   - Pro OFF → only Standard in purchase flow
   - Pro ON → Standard + Pro appear
   - Return Pro to OFF for intended production state

---

## Acceptance checklist (code-level)

- [x] Standard can be enabled/disabled from Admin
- [x] Pro can be enabled/disabled from Admin
- [x] State persists in DB (`Plan.isActive`)
- [x] Telegram reads active plans from backend
- [x] Pro OFF → hidden from new purchase flow
- [x] Pro ON → returns automatically
- [x] Stale Pro callback cannot create new purchase
- [x] Existing Pro licenses unaffected (no entitlement changes)
- [x] Pending orders have documented safe behavior
- [x] No text assumes exactly two plans
- [x] Zero-plan state handled
- [x] Admin UI entirely Russian
- [ ] Production E2E verified → **A**
