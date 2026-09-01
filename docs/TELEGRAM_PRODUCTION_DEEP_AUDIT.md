# TELEGRAM PRODUCTION DEEP AUDIT

**Repository:** `D:\Ruznamo-Backend`  
**Production API:** `https://ruznamo-backend-o4xk.vercel.app`  
**Mode:** READ-ONLY — no code, env, webhook, DB, commit, push, or deploy changes  
**Date:** 2026-09-01

---

## 1. Executive Summary

Telegram Bot **code is substantially implemented** in the backend (BLOCK 5A + Stage 2 license bridge). However, **production runtime shows zero Telegram activity** in the database:

| Entity | Count |
|--------|------:|
| TelegramAccount | 0 |
| Order | 0 |
| License | 0 |
| telegramProcessedUpdate | 0 |

**Verdict:** The bot is **not operationally working end-to-end in production**, despite token possibly being added to Vercel. The most likely blockers are:

1. **Webhook not registered** with Telegram (`setWebhook` exists only in docs — no script, no startup hook).
2. **Environment variable name mismatch** — code reads `TELEGRAM_BOT_TOKEN`; local `.env` still uses deprecated `TELEGRAM_USER_BOT_TOKEN` / `TELEGRAM_ADMIN_BOT_TOKEN` (empty).
3. **`TELEGRAM_BOT_USERNAME` missing** on production → Android cannot open bot via `GET /app/config`.
4. **`ADMIN_TELEGRAM_IDS` likely missing** → admin approve/reject notifications may not reach anyone.
5. **Payment display config may be empty** → bot can respond but show blank payment details.

**Do not rewrite Telegram from scratch.** Fix production configuration and verify webhook registration first.

---

## 2. Current Telegram Architecture

```
Telegram servers
      │ HTTPS POST (updates)
      ▼
POST /api/v1/telegram/webhook
      │ header: x-telegram-bot-api-secret-token
      ▼
TelegramWebhookController
      ▼
TelegramUpdateProcessor
      ├── /start → TelegramAccountService → User
      ├── callbacks → OrderService → Receipt
      ├── admin callbacks → PaymentApprovalService → License
      └── TelegramBotApiService → sendMessage/sendPhoto
      ▼
Neon PostgreSQL

Separate (legacy):
POST /api/v1/telegram/admin/webhook → AdminTelegramService (admin CRM link only)
```

Android connects **only** via mobile API + license key bridge (Stage 2). Android does **not** send Telegram ID.

---

## 3. Telegram Module Inventory

| File | Purpose | Runtime? | Used? | Tests? |
|------|---------|----------|-------|--------|
| `src/telegram/telegram.module.ts` | Wires controller, processor, bot API | ✅ loaded in `AppModule` | ✅ | indirect |
| `src/telegram/telegram-webhook.controller.ts` | `POST /api/v1/telegram/webhook` | ✅ | ✅ | ✅ spec |
| `src/telegram/telegram-update.processor.ts` | /start, payment, receipt, admin approve | ✅ | ✅ | ✅ spec |
| `src/telegram/telegram-bot-api.service.ts` | Raw `fetch` to `api.telegram.org` | ✅ | ✅ if token set | no dedicated spec |
| `src/telegram/telegram.messages.ts` | Tajik UI strings + callback constants | ✅ | ✅ | no |
| `src/telegram/telegram.types.ts` | Update/callback types | ✅ | ✅ | no |
| `src/payments/telegram-account.service.ts` | Create/find TelegramAccount + User | ✅ | ✅ | ✅ spec |
| `src/payments/order.service.ts` | Order + receipt flow | ✅ | ✅ | ✅ spec |
| `src/payments/payment-approval.service.ts` | Approve → License + outbox key | ✅ | ✅ | ✅ spec |
| `src/admin/telegram/admin-telegram.service.ts` | Admin panel Telegram link (RZ- codes) | ✅ | ✅ | ✅ spec |
| `src/admin/telegram/admin-telegram-webhook.controller.ts` | Legacy `/telegram/admin/webhook` | ✅ registered | ⚠️ legacy dual-bot | no |
| `src/admin/telegram/admin-telegram.controller.ts` | Admin API link token | ✅ | ✅ | no |

**No Telegraf / node-telegram-bot-api library** — uses native `fetch` to Bot API.

**Dead / legacy:** `AdminTelegramWebhookController` for old admin-only bot; main flow uses single bot at `/api/v1/telegram/webhook`.

---

## 4. Environment Variables Audit

| ENV (actual in code) | Required? | Secret? | Used in code | Production evidence |
|----------------------|-----------|---------|--------------|---------------------|
| `TELEGRAM_BOT_TOKEN` | For outbound API | **YES** | `configuration.ts` → `telegram.botToken` | **Cannot read Vercel**; local `.env` **missing this name** |
| `TELEGRAM_WEBHOOK_SECRET` | Production if token set | **YES** | webhook validation | **Configured** (401 without valid header) |
| `TELEGRAM_BOT_USERNAME` | Optional (Android deep link) | No | app config + admin deep links | **Missing** (`null` in `/app/config`) |
| `ADMIN_TELEGRAM_IDS` | For admin callbacks | **YES** (operational) | `telegram.adminTelegramIds` | **Unknown** (not exposed in API) |

**Deprecated names still in local `.env` (NOT read by code):**

| Deprecated | Status in local `.env` |
|------------|------------------------|
| `TELEGRAM_USER_BOT_TOKEN` | empty |
| `TELEGRAM_ADMIN_BOT_TOKEN` | empty |
| `ADMIN_TELEGRAM_CHAT_ID` | empty |

**Critical:** If Vercel was configured with deprecated names instead of `TELEGRAM_BOT_TOKEN`, the backend will treat the bot token as **empty** → `sendMessage` logs warning and returns without sending — bot appears “dead” even if webhook receives updates.

**`configuration.ts` behavior (production):**

- If `TELEGRAM_BOT_TOKEN` set but `TELEGRAM_WEBHOOK_SECRET` missing → token **cleared**, Telegram **disabled**, API still boots.
- Current production webhook requires secret → both are likely set **if** correct variable names were used.

---

## 5. Token Audit

| Check | Result |
|-------|--------|
| Token read via ConfigService | ✅ `telegram.botToken` |
| Token read via raw `process.env` | ✅ in `configuration.ts` only |
| Joi validation | Optional string |
| Backend starts without token | ✅ yes |
| Empty token behavior | `TelegramBotApiService` logs `TELEGRAM_BOT_TOKEN is not configured`, API calls skipped |
| Wrong env var name | ⚠️ **High risk** — deprecated names ignored |

**Live `getMe`:** Not executed — production token not available to this audit environment. Operator must run manually (see §6).

---

## 6. Webhook Audit

### Code

| Item | Status |
|------|--------|
| Endpoint | `POST /api/v1/telegram/webhook` |
| Controller registered | ✅ `TelegramModule` → `AppModule` |
| Public (no JWT) | ✅ `@Public()` |
| Throttle skipped | ✅ `@SkipThrottle()` |
| Secret header | `x-telegram-bot-api-secret-token` |
| Production without secret configured | `401 Telegram webhook secret is not configured` |
| Wrong/missing secret | `401 Invalid webhook secret` |
| Update idempotency | ✅ `TelegramProcessedUpdate` unique on `updateId` |
| Body parser | Standard Nest/Express JSON |

### Production probes (2026-09-01)

| Probe | Status | Response |
|-------|--------|----------|
| `GET /health` | 200 | ok |
| `GET /health/ready` | 200 | database up |
| `POST /webhook` (no secret header) | 401 | Invalid webhook secret |
| `POST /webhook` (wrong secret) | 401 | Invalid webhook secret |

**Interpretation:** `TELEGRAM_WEBHOOK_SECRET` is **set on Vercel**. Endpoint is **reachable from the internet**.

### Webhook registration (`setWebhook`)

| Location | Found? |
|----------|--------|
| Application startup | ❌ |
| `package.json` scripts | ❌ |
| `scripts/` | ❌ |
| CI/CD | ❌ |
| Docs only | ✅ `docs/BLOCK-5A-TELEGRAM-PAYMENT-FLOW.md` |

**Expected manual registration:**

```text
POST https://api.telegram.org/bot<TOKEN>/setWebhook
url = https://ruznamo-backend-o4xk.vercel.app/api/v1/telegram/webhook
secret_token = <TELEGRAM_WEBHOOK_SECRET>
```

### Live `getWebhookInfo`

**Not executed** (no access to production bot token in audit environment).

**Operator checklist:**

```bash
curl "https://api.telegram.org/bot<TOKEN>/getMe"
curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
```

If `url` is empty → **WEBHOOK NOT CONFIGURED** (primary root cause).

---

## 7. `/start` Flow Audit

| Step | Implementation |
|------|----------------|
| Handler | ✅ `TelegramUpdateProcessor.handleStart` |
| Telegram user id | ✅ `from.id` → `BigInt` |
| chat id | ✅ `message.chat.id` |
| Admin link code `/start RZ-...` | ✅ `AdminTelegramService.completeLinkFromBot` |
| User `/start` | ✅ `TelegramAccountService.resolveTelegramUser` |
| Creates User + TelegramAccount | ✅ transaction in service |
| Idempotent /start | ✅ existing TelegramAccount updated |
| Audit event | ✅ `telegram.user.started` |
| Welcome + period keyboard | ✅ if no active license |
| Active license path | ✅ subscription keyboard |

**Production evidence:** 0 `TelegramAccount` rows → **`/start` has never successfully persisted** (or webhook never delivered updates).

---

## 8. Bot Commands & UX

| Feature | Code exists | Runtime connected | Production tested | Gap |
|---------|-------------|-------------------|-------------------|-----|
| `/start` | ✅ | ⚠️ needs webhook | ❌ | webhook registration |
| `/help` | ✅ | ⚠️ | ❌ | |
| Period 1 month / 1 year | ✅ | ⚠️ | ❌ | |
| Payment info | ✅ | ⚠️ needs SystemConfig | ❌ | card may be empty |
| «Ман пардохт кардам» | ✅ | ⚠️ | ❌ | |
| Receipt photo/document | ✅ | ⚠️ | ❌ | |
| Admin notify + approve/reject | ✅ | ⚠️ needs ADMIN_TELEGRAM_IDS | ❌ | |
| License key delivery | ✅ | ⚠️ needs token + chatId | ❌ | |
| «Калиди ман» resend | ✅ | ⚠️ | ❌ | |
| PRO plan selection | ❌ | — | — | **Only STANDARD** in `PaymentConfigService.getStandardPrice` |

---

## 9. Payment Flow

```
/start → resolve user
→ PERIOD_MONTHLY | PERIOD_YEARLY callback
→ findOrCreatePendingOrder (STANDARD plan only)
→ send payment instructions
→ ACTION_PAID → markAwaitingReceipt
→ photo/document → submitReceipt → UNDER_REVIEW
→ notifyAdmins (ADMIN_TELEGRAM_IDS)
→ approve callback → PaymentApprovalService.approve → License
→ sendMessage with license key
```

| Item | Status |
|------|--------|
| Order linked to Telegram User | ✅ `order.userId` |
| Idempotent duplicate receipt | ✅ `telegramUpdateId` unique |
| Admin Panel orders API | ✅ `/api/v1/admin/orders` approve/reject |
| Telegram admin approve | ✅ same `PaymentApprovalService` |

---

## 10. Receipt Flow

| Item | Status |
|------|--------|
| Accept photo | ✅ largest photo file_id |
| Accept document | ✅ |
| Store `telegramFileId` | ✅ in `Receipt` table |
| Download file from Telegram | ❌ not implemented (file_id only) |
| Blob/S3 storage | ❌ not used |
| Admin views receipt in panel | ⚠️ metadata only unless UI shows file_id |

---

## 11. Admin Approval

| Channel | Status |
|---------|--------|
| Telegram inline buttons | ✅ primary path in BLOCK 5A |
| Admin Panel HTTP API | ✅ `/api/v1/admin/orders/:id/approve` |
| Authorization | ✅ `from.id ∈ ADMIN_TELEGRAM_IDS` for bot callbacks |
| Non-admin blocked | ✅ `telegram.admin.unauthorized` audit |

If `ADMIN_TELEGRAM_IDS` empty → receipts submitted but **no admin receives notification**.

---

## 12. License Flow (Stage 2 compatible)

| Item | Status |
|------|--------|
| License created on approve | ✅ `PaymentApprovalService` |
| `license.userId` = Telegram purchaser | ✅ preserved |
| Key hashed (`keyHash`) | ✅ |
| Plaintext key in outbox for resend | ✅ `NotificationOutbox` type `telegram_license_key` |
| Android activate cross-user | ✅ Stage 2 `LicenseActivation` bridge |
| `LICENSE_ALREADY_ACTIVATED` removed | ✅ |

---

## 13. Android Bridge

| Step | Code | Production E2E |
|------|------|----------------|
| `telegramBotUsername` in app config | ✅ field exists | ❌ null |
| Android opens `t.me/{username}` | Android-side | blocked until username set |
| User enters key in Android | Android-side | not tested |
| `POST /licenses/activate` | ✅ Stage 2 | not tested (0 licenses) |
| `GET /me/entitlements` after activation | ✅ | not tested |

---

## 14. Admin Panel Visibility

| Entity | Backend API | Admin UI | Production data |
|--------|-------------|----------|-----------------|
| User + Telegram | ✅ users API | ✅ Users page | 0 telegram-linked |
| Orders | ✅ orders API | ✅ Orders page | 0 |
| Receipts | ✅ in order detail | ✅ | 0 |
| Licenses | ✅ licenses API | ✅ Licenses page | 0 |
| Devices | ✅ devices API | ✅ Devices page | 4 (API test devices) |
| LicenseActivation | ⚠️ via license detail | partial | 0 |

---

## 15. Audit Events (existing in code)

| Event | Exists in code |
|-------|----------------|
| `telegram.user.started` | ✅ |
| `telegram.order.created` | ✅ |
| `telegram.receipt.submitted` | ✅ |
| `telegram.license.delivered` | ✅ |
| `telegram.admin.unauthorized` | ✅ |
| `payment.approved` / `payment.approved.duplicate` | ✅ |
| `license.activated` / `license.activation.idempotent` | ✅ (Android) |

**Production DB:** no `telegram.*` audit events found in recent logs (consistent with zero webhook activity).

---

## 16. E2E Simulation (25 steps)

| Step | Code exists | Connected | Production ready | Risk |
|------|-------------|-----------|------------------|------|
| 1 Android install | — | — | — | Android blockers |
| 2 device/register | ✅ | ✅ | ✅ | |
| 3 JWT | ✅ | ✅ | ✅ | |
| 4 Trial | ✅ | ✅ | ✅ | |
| 5 Trial ends | ✅ | ✅ | ✅ | |
| 6 Tap Telegram | Android | ⚠️ | ❌ | username null |
| 7 Open bot | — | ⚠️ | ❌ | |
| 8 User /start | ✅ | ⚠️ | ❌ | webhook |
| 9 TelegramAccount | ✅ | ⚠️ | ❌ | 0 in DB |
| 10 Choose plan | ✅ STANDARD only | ⚠️ | ❌ | no PRO in bot |
| 11 Order created | ✅ | ⚠️ | ❌ | |
| 12 User pays | manual | — | — | |
| 13 Receipt sent | ✅ | ⚠️ | ❌ | |
| 14 Admin sees pending | ✅ | ⚠️ | ❌ | ADMIN_TELEGRAM_IDS |
| 15 Admin approves | ✅ | ⚠️ | ❌ | |
| 16 License created | ✅ | ⚠️ | ❌ | |
| 17 Key sent in Telegram | ✅ | ⚠️ | ❌ | token + webhook |
| 18 User returns Android | — | — | — | |
| 19 Enter licenseKey | Android | ⚠️ | — | |
| 20 activate | ✅ Stage 2 | ⚠️ | ❌ | |
| 21 LicenseActivation | ✅ | ⚠️ | ❌ | |
| 22 entitlements refresh | ✅ | ⚠️ | ❌ | |
| 23 access=true | ✅ | ⚠️ | ❌ | |
| 24 STANDARD features | ✅ | ⚠️ | ❌ | |
| 25 Admin sees relationship | partial | ⚠️ | ❌ | |

---

## 17. Production Readiness Score

| Component | Score | Status | Blocking issue |
|-----------|------:|--------|----------------|
| Telegram code/module | 9/10 | 🟢 | PRO plan not in bot UI |
| TELEGRAM_BOT_TOKEN (correct name) | ?/10 | 🟡 | Cannot verify Vercel name |
| TELEGRAM_WEBHOOK_SECRET | 8/10 | 🟢 | Set on production |
| Webhook registration | 0/10 | 🔴 | No `setWebhook` automation; likely not registered |
| Webhook security | 8/10 | 🟢 | Secret validated |
| /start + TelegramAccount | 9/10 | 🔴 | Never ran in prod (0 rows) |
| Order + Receipt | 8/10 | 🔴 | No runtime data |
| Admin approval (Telegram) | 7/10 | 🔴 | ADMIN_TELEGRAM_IDS unknown |
| License generation | 9/10 | 🟡 | Code ready, 0 licenses |
| License delivery (sendMessage) | 8/10 | 🔴 | Needs token + inbound updates |
| Android bridge (Stage 2) | 9/10 | 🟡 | Deployed, E2E untested |
| Admin visibility | 7/10 | 🟡 | UI exists, no Telegram data |
| Payment config (card number) | ?/10 | 🟡 | Seed defaults empty |

---

## 18. Root Causes

### ROOT CAUSE #1 — Webhook likely not registered with Telegram

`setWebhook` is documented but **never executed** by code or CI. With 0 `TelegramProcessedUpdate` and 0 `TelegramAccount`, Telegram is probably **not delivering updates** to production.

### ROOT CAUSE #2 — Environment variable name mismatch risk

Code requires **`TELEGRAM_BOT_TOKEN`**. Local `.env` uses deprecated **`TELEGRAM_USER_BOT_TOKEN`** / **`TELEGRAM_ADMIN_BOT_TOKEN`** (empty). If Vercel was configured the same way, outbound bot messages fail silently.

### ROOT CAUSE #3 — Incomplete production Telegram configuration

- `telegramBotUsername`: **null** → Android cannot open bot from app config.
- `ADMIN_TELEGRAM_IDS`: likely unset → admin payment notifications won't work.
- Payment card/recipient SystemConfig may be empty → broken payment UX even if bot responds.

---

## 19. Blocking vs Non-Blocking

### BLOCKING

1. Register webhook via Telegram `setWebhook` to production URL + secret.
2. Verify Vercel env uses **`TELEGRAM_BOT_TOKEN`** (not deprecated names).
3. Set **`TELEGRAM_BOT_USERNAME`** for Android deep link.
4. Set **`ADMIN_TELEGRAM_IDS`** with numeric Telegram user IDs of approvers.
5. Configure **`PAYMENT_CARD_NUMBER`**, **`PAYMENT_RECIPIENT_NAME`**, **`PAYMENT_INSTRUCTIONS_TJ`** in SystemConfig.

### NON-BLOCKING

1. Add PRO plan selection to bot UI (currently STANDARD only).
2. Remove or document legacy `/api/v1/telegram/admin/webhook`.
3. Add `setWebhook` script or deploy hook for repeatability.
4. Admin UI for LicenseActivation cross-user view.

---

## 20. Implementation Plan (post-audit only)

| Phase | Focus | Files / actions |
|-------|--------|-----------------|
| **T1** | Production env | Vercel: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `TELEGRAM_BOT_USERNAME`, `ADMIN_TELEGRAM_IDS` |
| **T2** | Webhook | Manual or script `setWebhook`; verify `getWebhookInfo` |
| **T3** | Smoke test | `/start` → row in `TelegramAccount` |
| **T4** | Payment config | SystemConfig payment fields |
| **T5** | Receipt + admin notify | Test with real admin Telegram ID |
| **T6** | Approve → license → key message | End-to-end in Telegram |
| **T7** | Android | Open bot via config username; activate key |
| **T8** | Entitlements | Verify `access=true` |
| **T9** | Admin panel | Verify order/license visible |
| **T10** | Optional PRO plan in bot | `PaymentConfigService` + processor UI |
| **T11** | Observability | Monitor `telegramProcessedUpdate`, audit logs |
| **T12** | Production verification checklist | Repeat E2E table with HTTP evidence |

**No code rewrite required for T1–T9** if configuration is corrected.

---

## 21. Final Verdict

### Telegram production integration: **NOT OPERATIONAL**

- **Code:** implemented and deployed (partial evidence: Stage 2 app config shape + webhook secret enforcement).
- **Runtime:** **no Telegram users, orders, licenses, or processed updates** in production database.
- **Most probable fix:** configure env correctly + **register webhook** + set admin IDs + payment config — **not** a full Telegram rewrite.

---

## 22. Operator Commands (safe verification)

Replace placeholders locally — **do not commit tokens**.

```bash
# 1. Bot identity
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getMe"

# 2. Webhook status
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getWebhookInfo"

# 3. Register webhook (only if getWebhookInfo.url is empty)
curl -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://ruznamo-backend-o4xk.vercel.app/api/v1/telegram/webhook",
    "secret_token": "<TELEGRAM_WEBHOOK_SECRET>"
  }'
```

After `/start` in Telegram, verify in database:

```sql
SELECT COUNT(*) FROM "TelegramAccount";
SELECT COUNT(*) FROM "TelegramProcessedUpdate";
```

---

**NO CODE CHANGED · NO COMMIT · NO PUSH · NO DEPLOY**
