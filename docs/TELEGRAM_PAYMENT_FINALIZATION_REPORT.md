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

1. Choose plan: **Standard** or **Pro** (30-day / `MONTHLY` billing period)
2. Bot shows payment instructions + amount from DB prices
3. Order created with `awaitingReceipt: true` immediately (**no «Оплатил» button**)
4. User sends photo/document → receipt submitted → localized confirmation
5. Admin receives **actual attachment** + Russian review caption + inline buttons

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
npm test  → 109/109 PASS
npm run build → PASS
```

New/updated coverage: i18n TJ/RU, payment callback parsing, support photo relay, order `startPaymentFlow`, existing pairing/relay/admin auth.

---

## 6. Deployment requirements

1. **`prisma migrate deploy`** on Neon — adds `TelegramAccount.language`
2. **Seed or manual** — ensure PRO plan prices exist (30 TJS monthly in seed)
3. **Redeploy backend** after migration
4. **Webhook secret sync** — ensure `TELEGRAM_WEBHOOK_SECRET` matches Telegram registration (see prior audit)

**Not done:** commit, push, deploy (per user instruction).

---

## 7. Runtime limitations

- Plan selection UI currently offers **30-day (MONTHLY)** tariffs only; yearly (365-day) can be added via extra menu without schema change
- Admin review messages remain **Russian** (admin UX)
- PRO prices require DB seed/migration on production if not yet present
- Real Telegram E2E (language, receipt, approve, license delivery) not run in this session

---

## 8. Recommended production E2E

1. `/start` → choose 🇷🇺 → plan Standard → pay instructions
2. Send receipt photo → admin gets attachment + buttons
3. ✅ Approve → user receives RU license message
4. Repeat with TJ user
5. Send photo without order → admin support attachment
6. Web Admin approve on another order → same single-license semantics

---

## 9. Final verdict

**B** — Implementation and automated tests complete. Migration + production deploy + live Telegram verification required for **A**.
