# TELEGRAM ADMIN LINKING + USER MESSAGE RELAY — Audit & Repair Report

**Repository:** `D:\Ruznamo-Backend`  
**Date:** 2026-09-01  
**Scope:** Admin Telegram pairing via Web Admin Panel code + free-text user message relay to admin  
**Final verdict:** **B — Code repaired, deployment/runtime verification pending**

---

## 1. Initial symptoms

| Symptom | Status before fix |
|---------|-------------------|
| Webhook receives Telegram updates | ✅ Working (confirmed by user) |
| Admin Panel generates pairing code | ✅ Working |
| Sending code to `@Ruznamo_bot` as plain message | ❌ Bot silent, no response |
| `GET /api/v1/admin/telegram/status` after refresh | ❌ Still disconnected |
| Arbitrary user text to bot | ❌ No relay to admin, no user ack |

---

## 2. Root cause of pairing failure

**Primary root cause:** Pairing was only wired through `/start <code>` (deep link path). The main user-bot processor (`TelegramUpdateProcessor`) had **no handler for plain-text pairing codes**.

**User flow from Admin Panel:**

1. Admin clicks «Подключить Telegram» → `POST /api/v1/admin/telegram/connect`
2. Backend returns code like `RZ-A1B2C3` with instructions to send to bot
3. Admin copies and sends `RZ-A1B2C3` as a **normal text message**
4. Processor treated it as unknown text (or ignored it for admins) → **no `tryCompleteLinkFromBot` call** → no DB update → no bot reply

**Secondary factors (not blockers but relevant):**

- `ADMIN_TELEGRAM_IDS` alone does **not** create `AdminTelegramIdentity`; it is a whitelist for inline admin actions and support relay destination
- If `ADMIN_TELEGRAM_IDS` is set and sender's numeric Telegram user ID is **not** in the list, pairing is rejected even with a valid code (`reason: 'unauthorized'`)
- Code format is `RZ-` + 6 hex chars (not `ABCD-1234` as in the spec example — actual format documented in §3)

---

## 3. Existing admin Telegram architecture

### DB entities

| Entity | Purpose |
|--------|---------|
| `AdminTelegramLinkToken` | One-time pairing codes (`code`, `adminUserId`, `expiresAt`, `usedAt`) |
| `AdminTelegramIdentity` | Linked admin ↔ Telegram user (`telegramUserId`, `username`, `isVerified`, `verifiedAt`) |
| `AdminUser.telegramId` | Denormalized Telegram ID on admin user record |

### API endpoints

| Method | Path | Handler | Output |
|--------|------|---------|--------|
| `POST` | `/api/v1/admin/telegram/connect` | `AdminTelegramController.connect` | `{ code, expiresAt, deepLink, instructions }` |
| `GET` | `/api/v1/admin/telegram/status` | `AdminTelegramController.status` | `{ connected, isVerified, telegramUserId, username, ... }` |

### Full pairing chain (after fix)

```
Admin Panel (TelegramPage)
  → POST /api/v1/admin/telegram/connect
  → AdminTelegramService.createConnectToken()
  → AdminTelegramLinkToken row (RZ-XXXXXX, TTL 15 min)
  → User sends code to @Ruznamo_bot
  → POST /api/v1/telegram/webhook (secret header)
  → TelegramUpdateProcessor.processUpdate()
  → claimUpdate (TelegramProcessedUpdate idempotency)
  → handleMessage → normalizeAdminLinkCode(text)
  → AdminTelegramService.tryCompleteLinkFromBot()
  → validate token + whitelist → upsert AdminTelegramIdentity
  → bot replies TG.adminConnected (Russian)
  → Admin Panel GET /status → connected: true
```

### Legacy / parallel path

`AdminTelegramService.processAdminBotUpdate()` exists for a separate admin-bot webhook concept but the **production user bot** flows through `TelegramUpdateProcessor`. The fix targets the processor used by the live webhook.

---

## 4. ADMIN_TELEGRAM_IDS parsing

**Source:** `src/config/telegram-env.util.ts` → `readAdminTelegramIds()`

**Format:**

```text
ADMIN_TELEGRAM_IDS=123456789
ADMIN_TELEGRAM_IDS=123456789,987654321
```

- Comma-separated numeric Telegram **user** IDs
- Whitespace around IDs is trimmed
- Only digits matching `/^\d+$/` are kept (invalid tokens silently dropped)
- Legacy fallback: `ADMIN_TELEGRAM_CHAT_ID` (single ID) with deprecation warning
- **Not supported:** `@username`, `https://t.me/...`, bot names

**Single ID:** `ADMIN_TELEGRAM_IDS=123456789` — fully supported.

**Empty env:** `[]` — pairing allowed for any Telegram user (whitelist disabled); support relay skipped with audit log.

**Role in pairing (model B):**

```typescript
const envAllowed = envIds.length === 0 || envIds.includes(telegramIdStr);
```

- Pairing code proves admin-panel authentication (code tied to `adminUserId`)
- If whitelist is configured, the **Telegram sender** must also be in `ADMIN_TELEGRAM_IDS`
- Adding ID to env alone does **not** pair; code flow is still required

**Production note:** After changing `ADMIN_TELEGRAM_IDS` on Vercel, a **new deployment** is required for the runtime to read the updated value.

---

## 5. Pairing handler flow

### Code format

| Aspect | Value |
|--------|-------|
| Generated format | `RZ-` + 6 hex chars, e.g. `RZ-A1B2C3` |
| Case | Normalized to uppercase |
| Accepted inputs | `RZ-ABC123`, `rz-abc123`, `ABC123`, `/start RZ-ABC123`, deep link `?start=RZ-ABC123` |
| TTL | 15 minutes |
| One-time use | `usedAt` set on success |
| Not accepted | Random text, expired codes, consumed codes |

**Utility:** `src/admin/telegram/admin-link-code.util.ts`

### Bot responses (Russian)

| Outcome | Message |
|---------|---------|
| Success | «Telegram успешно подключён к админ-панели Ruznamo.» |
| Expired | «Код подключения истёк. Создайте новый код в админ-панели.» |
| Invalid / used / unauthorized | «Код подключения недействителен или уже использован.» (no internal leak) |

### Structured logging (no full codes)

```typescript
{ updateId, telegramUserId, handler: 'admin_pairing_plain' | 'admin_pairing_start' }
```

---

## 6. Files changed

| File | Change |
|------|--------|
| `src/admin/telegram/admin-link-code.util.ts` | **New** — normalize/detect pairing codes |
| `src/admin/telegram/admin-link-code.util.spec.ts` | **New** — unit tests |
| `src/admin/telegram/admin-telegram.service.ts` | `tryCompleteLinkFromBot()` with structured outcomes; deep link `encodeURIComponent` |
| `src/admin/telegram/admin-telegram.service.spec.ts` | Tests for expired/used/valid/unauthorized |
| `src/telegram/telegram-update.processor.ts` | Plain pairing handler before relay; support relay fallback |
| `src/telegram/telegram-update.processor.spec.ts` | Pairing priority + relay + admin callback tests |
| `src/telegram/telegram-support-relay.service.ts` | **New** — relay free text to admins |
| `src/telegram/telegram-support-relay.service.spec.ts` | **New** — relay tests |
| `src/telegram/telegram-bot-api.service.ts` | `sendPlainMessage()` (no Markdown injection) |
| `src/telegram/telegram.messages.ts` | Russian pairing + Tajik support ack messages |
| `src/telegram/telegram.module.ts` | Register `TelegramSupportRelayService` |
| `admin-panel/src/pages/TelegramPage.tsx` | Deep link display, refresh UX |
| `admin-panel/src/i18n/ru.ts` | Russian pairing instructions |

---

## 7. Pairing repair

**Fix:** In `TelegramUpdateProcessor.handleMessage()`, after `/help` and before admin-skip/relay:

```typescript
const pairingCode = normalizeAdminLinkCode(text);
if (pairingCode) {
  await this.tryAdminPairing(pairingCode, ...);
  return;
}
```

`/start` path unchanged — `extractAdminLinkCodeFromStart()` still works for deep links.

**Idempotency:**

- Same code twice → second attempt: `usedAt` set → `invalid`
- Same admin re-pairing → `upsert` on `AdminTelegramIdentity` (safe update)
- Another user with consumed code → `invalid`

---

## 8. Admin Panel status repair

No backend API change required — `GET /api/v1/admin/telegram/status` already reads `AdminTelegramIdentity`.

**UI (`TelegramPage.tsx`):**

- Shows connected state via `isVerified`
- Instructions: generate code → send to `@Ruznamo_bot` → refresh
- Deep link when `TELEGRAM_BOT_USERNAME` is configured
- All user-facing strings in Russian (`admin-panel/src/i18n/ru.ts`)

After successful pairing, admin clicks «Обновить статус» or reloads page → `connected: true`.

---

## 9. Free-text relay design

**Service:** `TelegramSupportRelayService.relayFreeText()`

**Destination:** All IDs in `ADMIN_TELEGRAM_IDS` via same bot (`sendPlainMessage`)

**Admin message format (Russian):**

```
📩 Новое сообщение в поддержку Ruznamo

Имя: ...
Username: @...
Telegram ID: ...
Заявка: <orderId> (<status>)   // if active order exists

Сообщение:
<text>
```

**User ack (Tajik):** «Паёми шумо ба маъмур фиристода шуд. Лутфан интизор шавед.»

**No admins configured:** User gets «Дастгирии муваққатан дастнорас аст…» + audit `telegram.support.relay.skipped`

**Delivery failure:** Per-admin try/catch; audit `telegram.support.relay.failed`; webhook does not crash

---

## 10. Handler priority

### Top-level (`processUpdate`)

1. Idempotency (`TelegramProcessedUpdate`)
2. `callback_query` → `handleCallback` (payment, admin approve/reject)
3. `message` → `handleMessage`

### Message text path (`handleMessage`)

| # | Condition | Handler |
|---|-----------|---------|
| 1 | Photo/document | Receipt upload flow |
| 2 | `/start` | User welcome **or** pairing via start param |
| 3 | `/help` | Help keyboard |
| 4 | `normalizeAdminLinkCode(text)` | **Admin pairing** |
| 5 | Sender in `ADMIN_TELEGRAM_IDS` | Silent return (no relay) |
| 6 | Awaiting receipt order | Prompt for receipt |
| 7 | Other free text | **Support relay** |

**Guarantees:**

- Pairing codes never reach support relay (step 4 returns early)
- `/start` without code → user flow, not relay
- Receipt photos/docs → receipt handler, not relay
- Callbacks (payment buttons) → separate path, not text relay

---

## 11. Security / privacy

| Topic | Mitigation |
|-------|------------|
| Pairing code entropy | 3 random bytes → 6 hex chars; 15 min TTL; one-time use |
| Whitelist | Optional `ADMIN_TELEGRAM_IDS` gate on pairing sender |
| Error messages | Same text for invalid/unauthorized (no enumeration) |
| Relay text length | Truncated at 3500 chars |
| Format injection | `sendPlainMessage` — no Markdown/HTML parse mode |
| Secrets in logs | Codes logged only as handler name; audit uses `codePrefix` |
| Spam / duplicate updates | `TelegramProcessedUpdate` prevents double processing |
| Admin ID in relay | Intentional for support context (private admin chat) |

---

## 12. Automated tests

| Suite | Coverage |
|-------|----------|
| `admin-link-code.util.spec.ts` | Normalize, `/start` extract, detection |
| `admin-telegram.service.spec.ts` | Expired, reused, valid bind, unauthorized whitelist |
| `telegram-update.processor.spec.ts` | Plain pairing before relay; relay for users; `/start` not relayed; admin callback auth |
| `telegram-support-relay.service.spec.ts` | Send to admins; empty `ADMIN_TELEGRAM_IDS` |
| `configuration.telegram.spec.ts` | Env parsing (existing) |

**Test run (2026-09-01):**

```
Test Suites: 1 failed, 26 passed, 27 total
Tests:       1 failed, 102 passed, 103 total
```

- **Failure:** `app.bootstrap.spec.ts` — Prisma cannot reach Neon DB from local env (pre-existing infra test, unrelated to this block)
- **All Telegram/pairing/relay suites:** PASS

---

## 13. Build

```
npm run build  →  PASS (nest build)
```

---

## 14. Runtime tests (local gate — 2026-09-01)

| Check | Result |
|-------|--------|
| `npm test` | **103/103 PASS** (all suites, including `app.bootstrap.spec.ts`) |
| Targeted Telegram suites | **34 tests PASS** (`telegram`, `admin-link`, `admin-telegram`) |
| `npm run build` | **PASS** |

Note: earlier session reported `app.bootstrap.spec.ts` failing when Neon was unreachable; at verification time DB was reachable and bootstrap passed.

---

## 15. PRODUCTION VERIFICATION (deploy session — 2026-09-01)

### Git / commit / push

| Item | Value |
|------|-------|
| Branch | `main` |
| Commit SHA | `e8e4f6c16804d13625e5e12476ceef1d3790f9a5` |
| Commit message | `баъд аз аудити бехатари m` |
| Remote | `origin/main` — **in sync** (no unpushed commits) |
| Working tree | **clean** — BLOCK changes already committed |

BLOCK files in commit `e8e4f6c` (14 files): pairing util, `AdminTelegramService`, `TelegramUpdateProcessor`, `TelegramSupportRelayService`, tests, admin-panel Telegram UI/i18n, this report.

**Secrets in git:** `.env` not tracked; no bot token / webhook secret / real admin IDs in committed files.

### Pre-deploy test gate

- Full suite: **103 PASS**
- Build: **PASS**

### Production env (masked, no secret values)

Local `.env` has **empty** `TELEGRAM_BOT_TOKEN` / `TELEGRAM_WEBHOOK_SECRET` — `npm run telegram:audit` cannot call `getMe` / `getWebhookInfo` from this machine.

Indirect production signals:

| Variable | Evidence |
|----------|----------|
| `TELEGRAM_WEBHOOK_SECRET` | **present** — `POST /api/v1/telegram/webhook` without header → **401** `Invalid webhook secret` |
| `TELEGRAM_BOT_TOKEN` | **likely present** — webhook endpoint active; `GET /api/v1/app/config` returns `telegramBotUsername: "Ruznamo_bot"` (bot enabled path) |
| `TELEGRAM_BOT_USERNAME` | **normalized** — production `telegramBotUsername` = `Ruznamo_bot` ✅ |
| `ADMIN_TELEGRAM_IDS` | **not verified remotely** — requires authenticated `GET /api/v1/admin/system/telegram` or Vercel dashboard; local `.env` empty |

Admin Panel frontend: **no** `TELEGRAM_BOT_TOKEN` / webhook secret in `admin-panel/` source or `.env.production` (only `VITE_API_BASE_URL`).

### Backend deployment

| Check | Result |
|-------|--------|
| `GET /health` | **200** `status: ok` |
| `GET /health/ready` | **200** database `up` |
| Vercel CLI deploy SHA | **not confirmed** — CLI not authenticated in this environment |
| Auto-deploy from `main` push | **assumed** — commit pushed; health endpoints healthy |

### Admin Panel deployment

| Check | Result |
|-------|--------|
| URL | `https://admin-panel-ten-tau-90.vercel.app` |
| Login page | Russian UI loads ✅ |
| New Telegram strings | **deployed** — JS bundle contains `Открыть бота в Telegram` |

### Webhook regression (`npm run telegram:audit`)

```
TELEGRAM_BOT_TOKEN: missing (local)
POST .../api/v1/telegram/webhook → 401 Invalid webhook secret
```

`getMe` / `getWebhookInfo` / `last_error_message` — **not run** (no local bot token). Re-run on a machine with `TELEGRAM_BOT_TOKEN` in `.env`:

```bash
npm run telegram:audit
```

### Production DB (AdminTelegramIdentity)

Probe at verification time (`scripts/probe-admin-telegram-status.ts`):

```json
{
  "connected": false,
  "isVerified": false,
  "telegramUserId": null
}
```

→ **Pairing E2E not yet completed** on production.

### Real E2E tests — NOT completed from automation

| Test | Status | Blocker |
|------|--------|---------|
| Admin Panel → generate `RZ-XXXXXX` | ⏳ | Admin login credentials not available in automation |
| Plain-text `RZ-XXXXXX` → bot Russian success | ⏳ | Requires manual Telegram send or local `TELEGRAM_BOT_TOKEN` |
| `AdminTelegramIdentity` created | ❌ not yet | DB shows disconnected |
| Admin Panel «Telegram подключён» | ⏳ | Depends on pairing |
| Free-text relay «Салом, ман савол дорам» | ⏳ | Requires non-admin Telegram user + `ADMIN_TELEGRAM_IDS` on production |
| Negative pairing tests | ⏳ | Manual |
| Handler regressions (`/start`, receipt, callbacks) | ⏳ | Manual |

### Regressions checked indirectly

| Flow | Status |
|------|--------|
| Webhook security | ✅ 401 without secret |
| Health / DB | ✅ ready |
| Web Admin approval without `ADMIN_TELEGRAM_IDS` | ✅ code unchanged — not re-tested live |
| License delivery on approve | ⏳ not tested (no test order) |

---

## 16. Remaining blockers

1. **Real Telegram E2E** — perform manually (checklist below) or run `npm run telegram:audit` locally with production `TELEGRAM_BOT_TOKEN` in `.env`
2. **Confirm `ADMIN_TELEGRAM_IDS`** on Vercel = numeric Telegram user ID(s); **redeploy** after any env change
3. **Vercel deployment SHA** — confirm in Vercel dashboard that production = `e8e4f6c`
4. **Pairing** — production DB still shows `connected: false` until admin sends code to `@Ruznamo_bot`

### Manual E2E checklist (for operator)

1. Login → Admin Panel → Telegram → generate code
2. From whitelisted Telegram account, send `RZ-XXXXXX` as **plain text** (not `/start`)
3. Expect: «Telegram успешно подключён к админ-панели Ruznamo.»
4. Refresh status → «Telegram подключён»
5. Re-send same code → rejection
6. From **non-admin** user: «Салом, ман савол дорам» → admin receives relay + Tajik ack to user

---

## 17. Final verdict

### **B — Code deployed (push complete), runtime E2E incomplete**

| Criterion | Status |
|-----------|--------|
| Commit + push to `main` | ✅ `e8e4f6c` |
| Production health / DB ready | ✅ |
| Webhook secret configured | ✅ (401 probe) |
| `TELEGRAM_BOT_USERNAME` normalized | ✅ `Ruznamo_bot` |
| Admin Panel UI deployed | ✅ new strings in bundle |
| `getWebhookInfo` / `last_error_message` | ⏳ needs local token |
| Plain-text pairing E2E | ❌ not verified (DB still disconnected) |
| Free-text relay E2E | ⏳ not verified |
| Handler regressions live | ⏳ not verified |

**Not A** — production Telegram pairing and relay were not confirmed end-to-end in this session.

**Not C** — no new production blocker found in code; deployment path healthy; pairing fix awaits operator E2E.

---

## Appendix: Negative test matrix (post-deploy)

| Input | Expected |
|-------|----------|
| Random `RZ-FFFFFF` (never issued) | Invalid message |
| Expired code | Expired message |
| Used code | Invalid message |
| Valid code, ID not in whitelist | Invalid message (same as invalid) |
| `/start` | User flow, no admin relay |
| Payment button callback | Payment flow |
| Receipt photo | Receipt handler |
| Valid pairing code | Pairing only, no support relay |
| Arbitrary Tajik text (regular user) | Relay + user ack |
| Duplicate `update_id` | Processed once only |
