# TELEGRAM PAYMENT FINALIZATION + BILINGUAL BOT — Report

**Repository:** `D:\Ruznamo-Backend`  
**Date:** 2026-09-01  
**Verdict:** **B — Code and tests complete; migration deploy + runtime E2E pending**

---

## 1. Existing architecture (before changes)

| Entity | Role |
|--------|------|
| `TelegramAccount` | Links Telegram user ↔ `User` |
| `Order` | Payment intent (`PENDING` → `UNDER_REVIEW` → `COMPLETED` / `REJECTED`) |
| `Receipt` | Telegram `file_id` for cheque photo/document |
| `License` | Created on approve; `keyHash` + `keyPrefix` in DB; raw key in outbox |
| `LicenseActivation` | Android device activation (separate from Telegram purchase) |
| `TelegramProcessedUpdate` | Webhook idempotency |

**Previous flow gaps:**

- Tajik-only hardcoded strings (`telegram.messages.ts`)
- No language persistence
- Monthly/yearly period buttons only (STANDARD plan implicit)
- «Ман пардохт кардам» button required before receipt
- Photo outside payment flow → `noAwaitingOrder` (silent UX failure)
- License expiry used calendar `setMonth(+1)` / `setFullYear(+1)` instead of exact days
- Admin callbacks used `approve:` prefix (kept as legacy alias)

**Preserved (not broken):**

- Webhook security + idempotency
- Admin pairing (`RZ-XXXXXX` plain text + `/start`)
- Free-text support relay
- `PaymentApprovalService` as single approve/reject authority
- Web Admin `PATCH /orders/:id/approve` path

---

## 2. Changes implemented

### Language model

- Migration `20260901120000_telegram_account_language`
- `TelegramAccount.language`: `TJ` | `RU` | `null`
- First `/start` without language → bilingual picker
- `🌐 Забон / Язык` in menus
- Stored preference reused on subsequent visits

### i18n layer

```
src/telegram/i18n/
  telegram-i18n.types.ts
  tj.ts
  ru.ts
  index.ts
```

All user-facing bot strings via `getTelegramI18n(language)`. Admin pairing messages remain Russian (`TG_ADMIN`).

### Payment UX

1. Choose plan: **Standard** or **Pro**
2. Choose duration: **30 days** (`MONTHLY`) or **365 days** (`YEARLY`) — prices from DB only
3. Bot shows payment instructions + DB-driven amount
4. Order created with `awaitingReceipt: true` immediately (**no «Оплатил» button**)
5. User sends photo/document → receipt submitted → localized confirmation
6. Admin receives **actual attachment** + Russian review caption + inline buttons

### Admin callbacks

- Format: `payment:approve:<orderId>` / `payment:reject:<orderId>`
- Legacy `approve:` / `reject:` still parsed
- Buttons removed after decision (`editMessageReplyMarkup`)
- Only `ADMIN_TELEGRAM_IDS` may approve/reject

### Support attachments

- Photo/document **with** active `awaitingReceipt` order → receipt flow
- Photo/document **without** → `TelegramSupportRelayService.relayMedia()` to admins

### License duration

- `MONTHLY` → **+30 days** from approval time
- `YEARLY` → **+365 days** from approval time
- Validity starts at **payment approval** (`startsAt` / `activatedAt` set in `PaymentApprovalService`)

Android `LicenseActivation` remains device-bound; Telegram purchase does not require Android to start the clock.

### License key security (audit)

| Property | Value |
|----------|-------|
| Generator | `crypto.randomBytes(32).toString('hex')` |
| Entropy | 256 bits |
| Storage | HMAC-SHA256 hash + 8-char prefix; raw key in `notificationOutbox` only |
| Logging | Approve audit logs `keyPrefix` only, not full key |
| Idempotency | Unique `orderId` on `License`; duplicate approve returns existing |

**No change required** — already CSPRNG-strong.

### Web Admin compatibility

- `AdminOrdersService.approve()` still calls `PaymentApprovalService.approve()`
- `TelegramLicenseDeliveryService` updated to use user language + 30/365 day messaging

---

## 3. Handler priority (after)

```
webhook auth
→ idempotency
→ callback (payment admin / language / plan / menu)
→ message photo/document (receipt OR support media)
→ /start (pairing / language / main menu)
→ /help
→ admin pairing plain code
→ admin telegram skip
→ free text support relay
```

---

## 4. Files changed

| Area | Files |
|------|-------|
| Schema | `prisma/schema.prisma`, migration `20260901120000_*` |
| Seed | `prisma/seed.ts` (PRO plan prices) |
| i18n | `src/telegram/i18n/*` |
| Processor | `src/telegram/telegram-update.processor.ts` |
| Messages | `src/telegram/telegram.messages.ts` |
| Bot API | `telegram-bot-api.service.ts` (`editMessageReplyMarkup`) |
| Orders | `order.service.ts`, `payment-config.service.ts` |
| Approval | `payment-approval.service.ts` (30/365 days) |
| Accounts | `telegram-account.service.ts` (`language`, `setLanguage`) |
| Support | `telegram-support-relay.service.ts` (`relayMedia`) |
| License delivery | `telegram-license-delivery.service.ts` |
| Admin orders | `admin-orders.service.ts` |
| Tests | processor, order, i18n specs |

---

## 5. Tests & build

```
npm test  → 110/110 PASS
npm run build → PASS
```

New/updated coverage: i18n TJ/RU, payment callback parsing, support photo relay, order `startPaymentFlow`, existing pairing/relay/admin auth.

---

## 6. Production DB pricing (verified)

After `prisma db seed` on Neon:

| Plan | 30 days (MONTHLY) | 365 days (YEARLY) |
|------|-------------------|-------------------|
| STANDARD | 15 TJS | 150 TJS |
| PRO | 30 TJS | 300 TJS |

Duration buttons appear only for combinations with active `PlanPrice` rows.

---

## 7. PRODUCTION RELEASE (2026-09-01)

### Migration

| Item | Result |
|------|--------|
| Migration | `20260901120000_telegram_account_language` |
| Command | `prisma migrate deploy` |
| Result | **Applied successfully** before backend deploy |
| Strategy | Additive `TelegramAccount.language` nullable enum |

### Pre-deploy gates

| Gate | Result |
|------|--------|
| `npm test` | **110/110 PASS** |
| `npm run build` | **PASS** |
| Secrets in git | None (.env not tracked) |

### Telegram runtime audit (post-migration, pre-deploy of duration commit)

| Check | Result |
|-------|--------|
| `getMe.ok` | true |
| `@Ruznamo_bot` | confirmed |
| Webhook URL | correct production URL |
| `last_error_message` | **null** |
| `pending_update_count` | 0 |
| Probe without secret | 401 (expected) |
| Probe with secret | **200** |
| `telegramBotUsername` in app config | `Ruznamo_bot` |

### Deploy

| Item | Value |
|------|-------|
| Branch | `main` |
| Commit | `16bedc26d525eab6e36b8eb37262535a85d59bf7` |
| Push | authorized in this BLOCK |

### Production E2E (Telegram)

| Test | Status |
|------|--------|
| Language TJ/RU selection + persistence | ⏳ Manual |
| Plan → duration → payment instructions | ⏳ Manual |
| Photo receipt → admin attachment | ⏳ Manual |
| PDF/document receipt | ⏳ Manual |
| Admin approve → one license + key delivery | ⏳ Manual |
| Reject flow | ⏳ Manual |
| Support media outside payment | ⏳ Manual |
| Duplicate approve idempotency | ⏳ Manual |
| Web Admin approve regression | ⏳ Manual |

Automated agent cannot complete real Telegram UI interactions in this session.

---

## 8. Runtime limitations

- Admin review messages remain **Russian** (admin UX)
- `TELEGRAM_BOT_USERNAME` should be set on Vercel for deep links (app config already normalizes)

---

## 9. Recommended production E2E checklist

1. `/start` → 🇹🇯 / 🇷🇺 → language persists on restart
2. Standard → 30 days → instructions show 15 TJS
3. Pro → 365 days → instructions show 300 TJS
4. Send receipt photo → admin attachment + buttons
5. ✅ Approve → exactly one license, localized key to user
6. ❌ Reject on separate order → no license
7. Photo without active order → support relay to admin
8. Web Admin approve → same `PaymentApprovalService` semantics

---

## 10. Final verdict

**B** — Migration applied, webhook healthy, code/tests/build green, backend release pushed. **Real Telegram E2E not automated** — operator checklist required for **A**.

---

## 11. Navigation + duration + payment methods update (2026-09-01)

### DEAD-END NAVIGATION ROOT CAUSE

Bot used **inline keyboards only**. After approve/reject/license view, old inline buttons became stale or disappeared — user had no persistent actions.

### PERSISTENT MAIN MENU

`ReplyKeyboardMarkup` (persistent, resize) for users:

| RU | TJ |
|----|-----|
| 🛒 Купить лицензию | 🛒 Харидани иҷозатнома |
| 🔑 Мои лицензии | 🔑 Иҷозатномаҳои ман |
| 💬 Поддержка | 💬 Дастгирӣ |
| 🌐 Язык | 🌐 Забон |

Inline `🏠 Главное меню` on purchase sub-flows. `/start` and `/help` commands registered.

### PRO 365-DAY BUG ROOT CAUSE

**Primary:** `ACTION_MY_KEY` handler hardcoded `const days = 30` while `expiresAt` in DB was correct for YEARLY orders.

**Not** a stale session between STANDARD/30 and PRO/365 — approval path already used `billingPeriodDays(order.billingPeriod)`.

### DURATION SINGLE SOURCE OF TRUTH

- `LICENSE_DURATION_DAYS` + `billingPeriodDays()` / `resolveOrderTermDays()`
- All user messages derive days from `Order.billingPeriod` or `License.order.billingPeriod`
- `paymentApproved(planName, days, expiresAt, key)` — structured message with plan + term + date

### REPEATED PURCHASE STATE RESET

`OrderService.cancelStalePendingPurchases()` cancels orphan `PENDING` orders without receipts before new purchase. `awaitingReceipt` set only **after** payment method selection.

### PAYMENT METHOD ARCHITECTURE

New Prisma models:

- `PaymentMethod` (PHONE | CARD, name, paymentValue, recipientName, isActive, sortOrder)
- `Order` snapshot fields: `paymentMethodName`, `paymentMethodType`, `paymentMethodValue`, `paymentMethodRecipient`
- `TelegramBotSession` for admin wizard state

Migration: `20260901180000_payment_methods_and_telegram_nav`

### ADMIN PAYMENT METHOD UX

`ADMIN_TELEGRAM_IDS` only — reply keyboard `💳 Реквизиты` / `📋 Заявки`. Wizard: add/edit/toggle/delete via inline callbacks. Russian admin UI.

### PAYMENT METHOD HISTORY SAFETY

Orders store **snapshot** at selection time. Disabling/deleting method does not mutate historical orders. `safeDelete()` disables when orders reference method.

### USER FLOW (updated)

`plan → duration → summary → payment method → requisites → receipt → admin review → license`

Callback `paymethod:<id>` — ID only, never card/phone in callback_data.

### TEST RESULTS

- **124/124** Jest tests PASS
- `license-term.util.spec.ts` — MONTHLY=30, YEARLY=365
- `payment-method.service.spec.ts` — CRUD + safe delete
- `order.service.spec.ts` — stale pending reset

### REMAINING RUNTIME CHECKS

| Check | Status |
|-------|--------|
| Persistent menu after approve/reject | ⏳ Manual |
| PRO 365 shows 365 days in delivery + My Licenses | ⏳ Manual |
| Sequential STANDARD/30 → PRO/365 | ⏳ Manual |
| Admin add payment method via Telegram | ⏳ Manual |
| User selects method → correct requisites | ⏳ Manual |
| Migration deploy on Neon | ⏳ Required before production |

### VERDICT (this block)

**B** — Root cause fixed in code, architecture implemented, tests green. **A** requires production migration + Telegram E2E.
