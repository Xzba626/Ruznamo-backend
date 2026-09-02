# Production Recovery Report — Revised

**Date:** 2026-09-02 (revised after human review)  
**Recovery pass:** autonomous migrate deploy + verification  
**HEAD:** `6e0209c` on `origin/main`

---

## Verdict philosophy

**A** = code + tests + deployed + **you opened, clicked, and saw the correct result**.  
**B** = implementation or infrastructure verified, but **human runtime QA still pending**.  
**C** = broken or blocked.

Synthetic probes (HTTP 200, Prisma query OK, dry-run scripts) **do not** upgrade an area to A.

---

## Deployment truth

| Item | Value |
|------|-------|
| **Backend** | `https://ruznamo-backend-o4xk.vercel.app` |
| **Admin** | `https://admin-panel-ten-tau-90.vercel.app` |
| **Admin bundle** | `index-C_yK8i38.js` |

---

## Confirmed fix: schema drift (production blocker)

**Chain (evidence, not assumption):**

```text
P2022 Order.paymentMethodId missing
  → schema drift (code ahead of Neon)
  → prisma migrate deploy (2 additive migrations)
  → Order.findMany succeeds again
  → /health/ready database up
```

**CODE:** YES | **TEST:** YES | **DEPLOYED:** YES | **RUNTIME VERIFIED:** YES

**Commercial DB state:** STANDARD `isActive=true`, PRO `isActive=false`.

---

## Current status by area

| Area | Verdict | What is proven | What is NOT proven yet |
|------|---------|----------------|------------------------|
| **Production consistency** | **A** | Schema aligned; health OK; Order queries work | — |
| **Telegram** | **B** | Webhook 401/200; synthetic `/start` → HTTP 200 | Real user sees reply in chat |
| **Payment Orders** | **B** | API no longer 500 (`probe-admin-orders-list`) | Admin UI after login |
| **Plan management** | **B** | DB: Standard ON, Pro OFF | Admin toggle persistence + Telegram reflection |
| **Payment flow** | **B** | Architecture deployed; legacy AppConfig fallback works | Multi-method UX (`PaymentMethod` rows = 0) |
| **License / device link** | **B** | Existing journeys in forensic audit | New activation E2E |
| **Test data cleanup** | **B — NEEDS HUMAN CLASSIFICATION** | Dry-run script safe; 0 *deterministic* matches | Production visually still has suspicious rows |
| **Admin profile** | **B** | `displayName` PATCH exists in code | Save → F5 persistence |
| **Admin system** | **B** | Backend reads real device versions | System page after login |
| **Analytics** | **B** | Code + tests | Page after login |
| **Security** | **B** | Webhook secret enforced | Full admin authz walkthrough |

---

## Test data cleanup — corrected assessment

**Previous (too optimistic):** `TEST DATA CLEANUP = A` because dry-run returned 0 CONFIRMED TEST rows.

**Correct reading:**

- `0 deterministic matches` means the **cleanup script's narrow rules** did not auto-classify rows.
- It does **NOT** mean production is clean.
- Forensic heuristics (read-only, `scripts/forensic-data-audit.ts`) already flagged **likely** test data, e.g.:
  - **4 devices** with names like `Test Android`, `Local Test`, `Production Test` and fixture installation IDs
  - **1 user** `displayName: TestUser`
  - **121** audit log rows (not auto-deletable without human review)

**Next step:** After admin login, review **Пользователи**, **Устройства**, **Лицензии**, **Журнал аудита**. Mark known test rows by ID. Then run targeted cleanup with explicit IDs — not broad age/inactivity deletes.

**Verdict:** **B / NEEDS HUMAN CLASSIFICATION**

---

## Payment flow — corrected assessment

| Layer | Status |
|-------|--------|
| `PaymentMethod` table + Telegram `💳 Реквизиты` wizard | Deployed in code |
| Production `PaymentMethod` rows | **0** |
| Current buyer experience | **Legacy fallback** — `AppConfig` card/recipient when no active methods |
| Multi-method UX (Душанбе Сити, Alif, …) | **Not configured** until admin creates requisites |

This is not a bug; it is **missing production configuration**. Status:

> New multi-payment-method architecture is deployed; production configuration is not filled in.

---

## Manual QA checklist (human — before next code block)

Do these in order. Tick only when you **see** the result.

| # | Check | Expected |
|---|-------|----------|
| 1 | **Админ → Заявки на оплату** | Opens; no red server/database error |
| 2 | **Telegram `/start`** | Bot replies in chat; language or persistent main menu |
| 3 | **Купить лицензию** | Only **Standard**; Pro absent |
| 4 | **Админ → Тарифы** | Standard = Доступен; Pro = Отключён |
| 5 | **Админ → Система** | Real device version distribution (not hardcoded single `1.0.0`) |
| 6 | **Админ → Профиль** | Change display name → save → F5 → name persists |

### After Telegram responds — configure requisites

Admin Telegram → **💳 Реквизиты** → create at least one method (e.g. Душанбе Сити, phone type).

### Full payment E2E (raises Telegram / Payment / License to A)

```text
/start → Standard → 30 or 365 → payment method → requisites → receipt
→ admin receives attachment → ✅ Подтвердить → key to user → Мои лицензии
```

Also test rejection path and support text/photo/document.

### Admin screen-by-screen (no new backend features first)

```text
Заявки → Тарифы → Telegram → Профиль → Система → Аналитика
→ Пользователи → Устройства → Лицензии → Аудит
```

While reviewing Users/Devices/Licenses/Audit: note test row IDs for safe cleanup.

---

## Infrastructure summary (operator view)

| Component | Status |
|-----------|--------|
| Backend infrastructure | Stabilized |
| Telegram transport / webhook | Technically healthy; real user test needed |
| Admin Orders API | Fixed; UI needs login QA |
| Plans | DB correct; UI toggle needs QA |
| Payments | Architecture present; requisites not configured |
| Test data | Not clean — needs human classification |
| License / device chain | Confirmed on existing data; new activation E2E pending |

---

## What not to do yet

- Do **not** add new backend features before manual QA above.
- Do **not** run broad production deletes.
- Do **not** treat `0 dry-run matches` as "production cleaned".

---

## Evidence references

| Script | Purpose |
|--------|---------|
| `scripts/production-db-drift.ts` | Schema + migration state |
| `scripts/probe-admin-orders-list.ts` | Order list query post-migrate |
| `scripts/probe-telegram-start.ts` | Synthetic `/start` webhook |
| `scripts/telegram-runtime-audit.ts` | getMe, webhook info, secret probe |
| `scripts/forensic-data-audit.ts` | Inventory + likely-test heuristics |
| `scripts/cleanup-confirmed-test-data.ts` | Dry-run cleanup (deterministic rules only) |
| `scripts/probe-telegram-auth-production.ts` | Prod challenge + schema tables |
| `scripts/probe-telegram-auth-extended.ts` | Prod webhook auth_ + wrong OTP + webhook health |

---

## Corrective block after e8cf668 (2026-09-02)

Targeted fixes for three proven gaps. **HEAD:** `3f1a570` on `origin/main`.

### Test suite delta

| Baseline | After corrective | Delta |
|----------|------------------|-------|
| e8cf668: **134 PASS** | **153 PASS** | +19 meaningful tests |

**Restored regression (was removed in e8cf668):**

- `PaymentApprovalService` — reject eligible order; approve without receipt
- `LicenseIssuanceService` — P2002 unique `orderId` race (new owner file)

**New coverage:**

- `TelegramCommandsService` — `setMyCommands` + `setChatMenuButton({ type: "commands" })`
- `TelegramSupportRelayService` — user→admin mapping; admin→user reply routing (A/B isolation)
- `TelegramUpdateProcessor` — admin native Reply handling; unknown target message
- `telegram-no-persistent-keyboard.spec.ts` — no persistent ReplyKeyboardMarkup regression

### Feature verdicts (honest)

| Feature | CODE | TEST | DEPLOYED | RUNTIME VERIFIED | EVIDENCE |
|---------|------|------|----------|------------------|----------|
| **MENU BUTTON** | YES | YES | YES | **B+** | API: `getChatMenuButton` → `{ type: "commands" }`, 7 commands; human Menu UI pending |
| **SUPPORT USER→ADMIN** | YES | YES | YES | B | Relay + `SupportRelayMapping` table (migration applied) |
| **SUPPORT ADMIN→USER** | YES | YES | YES | B | Reply-to mapping; round-trip needs human QA |
| **SUPPORT ROUTING SAFETY** | YES | YES | YES | B | Unique `(adminChatId, adminMessageId)`; automated A/B tests |
| **PAYMENT REGRESSION TESTS** | YES | YES | YES | YES (tests) | reject + no-receipt restored |
| **LICENSE ISSUANCE RACE TEST** | YES | YES | YES | YES (tests) | P2002 + `racedDuplicate` handling |

**A verdict** only after real Telegram: Menu opens commands, support round-trip, exit support → no relay.

---

## License identity & linking block (2026-09-02)

Migration `20260902140000_license_telegram_identity` applied.

### Test suite

| Baseline | After block |
|----------|-------------|
| 157 PASS | +4 (link token util, sales analytics) |

### Feature verdicts

| Feature | CODE | TEST | DEPLOYED | RUNTIME | EVIDENCE |
|---------|------|------|----------|---------|----------|
| **TELEGRAM LICENSE LINK** | YES | YES | pending | **B** | Challenge API + bot confirm flow; E2E pending |
| **LICENSE HOLDER** | YES | YES | pending | **B** | purchaser/holder FK + backfill TELEGRAM_PAYMENT |
| **DEVICE REPLACEMENT** | YES | partial | pending | **B** | Challenge + holder confirm; 24h cooldown |
| **ADMIN CONTROL** | YES | partial | pending | **B** | revoke device, unlink/assign holder APIs |
| **SALES ANALYTICS** | YES | YES | pending | **B** | GET `/admin/analytics/sales`; admin UI section |
| **TEST DATA CLEANUP** | YES | dry-run | N/A | **B** | 6 CONFIRMED TEST rows (1 user, 4 devices); `--apply` needs human OK |

---

## Telegram authentication & recovery block (2026-09-02)

Migration `20260902160000_telegram_auth_recovery` applied to Neon **before** code deploy (additive, backward-compatible).

**HEAD (deployed):** `09fca16` on `origin/main`  
**Tests:** 167/167 PASS | **Build:** PASS

### Pre-deploy security (code review)

| Control | Status | Evidence |
|---------|--------|----------|
| Opaque `auth_` token → `tokenHash` only in DB | YES | `TelegramAuthService.createChallenge` |
| OTP stored as SHA-256 hash, 5 min TTL | YES | `hashOtp`, `OTP_TTL_MS` |
| Max 5 OTP attempts → challenge consumed | YES | `telegram-auth.service.spec.ts` |
| Challenge 15 min TTL, single-use on verify | YES | `consumedAt` on success |
| Recovery grant 10 min, bound to device + mobile user | YES | `assertValidGrant` |
| Holder-only license ops (not purchaser) | YES | `holderTelegramAccountId` filter + unit test |
| Android never sends `telegramId` | YES | verify DTO = `{ challengeId, code }` only |
| Key reveal requires grant + session + holder | YES | `assertValidGrant` + `assertLicenseHeldByGrant` |
| No OTP/key in logs | YES | repo grep; audit metadata excludes plaintext key |
| Auth does not create Order/License/sale | YES | no commerce writes in auth/recovery services |

**IDOR model (confirmed):** `recoveryGrantId` alone is **insufficient**. Authorization requires valid JWT/mobile session **and** grant `mobileUserId` + `deviceId` match **and** unexpired grant **and** holder owns license. Fake grant probe → 404.

### Production probes (2026-09-02)

| Probe | Result |
|-------|--------|
| `prisma migrate status` | 12 migrations, schema up to date |
| DB tables | `TelegramAuthChallenge`, `TelegramRecoveryGrant` present |
| `GET /health` | 200 |
| `GET /health/ready` | 200, database up |
| `GET /api/v1/app/config?platform=ANDROID` | 200 (note: path is `/api/v1/app/config`, not `/app/config`) |
| `POST /api/v1/auth/telegram/challenge` | **201**, deepLink `Ruznamo_bot` + `auth_` prefix |
| Webhook `/start auth_*` | **200**, Telegram bound, OTP hash issued in DB |
| Wrong OTP verify | **400** `AUTH_OTP_INVALID` |
| Fake grant list (other device) | **404** |
| Telegram `getWebhookInfo` | OK, `last_error_message: null`, pending 0 |

Scripts: `scripts/probe-telegram-auth-production.ts`, `scripts/probe-telegram-auth-extended.ts`

### Feature verdicts

| Feature | CODE | TEST | DEPLOYED | RUNTIME VERIFIED | EVIDENCE |
|---------|------|------|----------|------------------|----------|
| **TELEGRAM AUTH ENGINE** | YES | YES | **YES** | **B+** | Prod challenge 201; webhook binds sender |
| **OTP ISSUE** | YES | YES | **YES** | **B+** | DB `otpHash` set after auth_ start; Telegram webhook healthy |
| **OTP VERIFY (correct)** | YES | YES | **YES** | **B** | Wrong OTP prod-tested; correct OTP needs real Telegram read |
| **RECOVERY GRANT** | YES | YES | **YES** | **B** | Issued on verify (unit); grant expiry/replay in unit tests |
| **LICENSE LIST (recovery)** | YES | YES | **YES** | **B** | Holder filter in code; prod list pending correct OTP |
| **KEY REVEAL** | YES | YES | **YES** | **B** | IDOR + audit without key; prod reveal pending OTP E2E |
| **KEYLESS ACTIVATION** | YES | YES | **YES** | **B** | Device limit preserved; prod activate pending OTP E2E |
| **REPLACEMENT VIA GRANT** | YES | partial | **YES** | **B** | Reuses `executeReplacement`; prod pending OTP E2E |
| **KEY FALLBACK (`/licenses/activate`)** | YES | YES | **YES** | **B** | Unchanged; regression in existing suite |
| **SALES ANALYTICS REGRESSION** | YES | YES | **YES** | **YES** | Auth/recovery creates no Order/License |
| **SECURITY / IDOR** | YES | YES | **YES** | **B+** | Grant+JWT+device binding; fake grant 404 on prod |

**A verdict** for Telegram auth block only after Huawei E2E: `Telegram → OTP → licenses → reveal key → activate without key → replacement`.

### Next step (explicit gate)

1. ~~Backend commit + push + deploy~~ **DONE** (`09fca16`)
2. **Android Cursor** — implement UI on stable contract (see Android block spec)
3. **Huawei runtime E2E** — one holder account, full recovery/login path

