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

## 14. Runtime tests possible locally

Without production deploy, locally verifiable:

- Unit/integration tests above ✅
- `npm run build` ✅
- Manual webhook simulation via processor specs ✅

Requires DB + bot token for full local E2E (not run in this session).

---

## 15. Production tests NOT performed (deploy required)

The following require **backend deploy to Vercel** (not done — per user instruction):

| Test | Expected |
|------|----------|
| Generate code in Admin Panel | `RZ-XXXXXX` displayed |
| Send `RZ-XXXXXX` to `@Ruznamo_bot` | Russian success message |
| Refresh Admin Panel status | Telegram подключён |
| User sends «Салом, ман савол дорам» | Admin receives relay; user gets Tajik ack |
| Invalid code | Generic invalid message |
| Expired code | Expired message |
| `/start` | User welcome, not relayed |
| Pairing code | Not relayed as support message |

---

## 16. Remaining blockers

1. **Deploy** — uncommitted changes must be deployed to production for live verification
2. **`ADMIN_TELEGRAM_IDS`** — must be numeric Telegram user ID; redeploy after env change
3. **`TELEGRAM_BOT_USERNAME`** — should be `Ruznamo_bot` (not full URL) for deep links
4. **`app.bootstrap.spec.ts`** — fails without live DB; consider mocking Prisma in CI
5. **Admin Panel deploy** — UI instruction updates in `admin-panel/` need separate Vercel deploy

---

## 17. Final verdict

### **B — Code repaired, deployment/runtime verification pending**

| Criterion | Status |
|-----------|--------|
| Root cause identified | ✅ Plain-text pairing handler missing |
| Targeted fix implemented | ✅ |
| Handler priority correct | ✅ |
| Automated tests for pairing/relay | ✅ |
| Build | ✅ |
| Production Telegram pairing E2E | ⏳ Pending deploy |
| Production free-text relay E2E | ⏳ Pending deploy |

**Not A** because real Telegram pairing and relay delivery were not verified against production `@Ruznamo_bot` after deploy.

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
