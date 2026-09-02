# Backend / Admin / Telegram — Final Architecture Audit

**Date:** 2026-09-02  
**Repository:** `D:\Ruznamo-Backend`  
**Migration:** `20260902180000_standard_entitlement_and_support_inbox`  
**Tests:** 167/167 PASS | **Build:** PASS

---

## BEFORE

| Area | State |
|------|--------|
| Standard device limit | PlanFeature `max_devices=1` (seed + production) |
| Standard monthly price | 15 TJS (DB PlanPrice) |
| Telegram commands | 7+ overlapping user commands (`start`/`home` duplicate, `/buy`, `/licenses`, …) |
| Main menu | Mixed welcome text; no «Восстановить доступ»; admin saw separate admin-only `/start` |
| Support vs receipt | **Bug:** text in SUPPORT mode could receive «Отправьте чек» if Order.awaitingReceipt |
| Support admin UX | Ephemeral relay only (`SupportRelayMapping`); no conversation history/inbox |
| LINK_ACCOUNT | Separate `lic_` button flow without unified OTP auth purpose |
| Analytics definitions | English key→string dump in Admin UI |

---

## ROOT CAUSE

1. **Standard entitlement drift** — seed and PlanFeature still encoded 1 device / 15 TJS while product spec moved to **2 devices / 20 TJS monthly**.
2. **Support/receipt race** — `handleFreeTextMessage` checked `awaitingReceipt` **before** `support` session, violating state priority.
3. **Telegram UX** — command menu exposed every action; inline main menu underdeveloped.
4. **Support persistence** — relay mapping sufficient for reply routing but not for admin inbox/history.

---

## CHANGES

### Commercial / entitlement (authoritative: PlanFeature + PlanPrice)

- Migration updates **Standard `max_devices` → 2** (all licenses read limit from plan at runtime — no per-license snapshot).
- Migration updates **Standard MONTHLY price → 20.00 TJS** (YEARLY unchanged at 150 TJS).
- Seed aligned for fresh environments.

### Telegram auth

- Added `TelegramAuthPurpose.LINK_ACCOUNT` + optional `contextLicenseId` on challenge.
- Android: `POST /auth/telegram/challenge { purpose: "LINK_ACCOUNT", licenseId }` → OTP → auto holder link on verify.
- Existing `lic_*` deep link preserved for backward compatibility.

### Telegram UX

- **Minimal commands:** `/start`, `/home`, `/stop`, `/instruction` (+ `/admin` for admin chat scope).
- **Inline main menu:** Купить / Мои лицензии / **Восстановить доступ** / Инструкция / Поддержка / Язык (+ Admin menu for admins).
- `/stop` clears transient purchase/support session → main menu.
- Admin `/start` → same user main menu + admin entry (not admin-only wall).

### Support

- **`SupportConversation` + `SupportMessage`** persisted on user messages.
- Admin **Support Inbox** in Telegram admin menu (list/open/close).
- **SUPPORT_ACTIVE wins** over stale `awaitingReceipt` for text and media.

### Admin analytics

- Metric definitions → **Russian structured table** (title, meaning, formula, source, refresh).
- Only metrics that exist in current analytics APIs.

---

## TESTS

- Standard **2/2** slot enforcement updated in `licenses.service.spec.ts`, `license-recovery.service.spec.ts`.
- Telegram commands spec updated for minimal menu.
- Support relay spec updated for conversation persistence.
- **167/167 PASS**

---

## DEPLOY

| Step | Status |
|------|--------|
| Migration applied (Neon) | **YES** — `20260902180000_standard_entitlement_and_support_inbox` |
| Code commit + push | Pending this commit |
| Vercel production SHA | Verify after push |

---

## REAL TELEGRAM / ADMIN RUNTIME

| Scenario | Verdict | Notes |
|----------|---------|-------|
| Regular `/start` → clean main menu | **B** | Code deployed; human click pending |
| Admin menu + user menu coexist | **B** | Implemented |
| Support text NOT receipt prompt | **B** | Fix in code; E2E pending |
| Support inbox shows conversations | **B** | After user sends support message |
| Standard purchase shows 20 TJS/month | **B** | DB price updated; Telegram UI reads DB |
| Standard 3rd device blocked | **B** | Domain logic + tests |
| LINK_ACCOUNT OTP link | **B** | API ready; Android + E2E pending |
| Analytics definitions RU table | **B** | Admin panel after deploy |

**No area marked RUNTIME=A** without production Telegram clicks in this pass.

---

## RESULT

Architecture block **implemented in code + migration + tests**. Purchaser/holder/activator, Telegram OTP/recovery grant, and LicenseActivation models **unchanged in design**.

**Next gates:**

1. Commit + push + Vercel deploy verification  
2. Production Telegram QA (regular + admin + support E2E)  
3. Android Cursor — UI for LINK vs RECOVERY vs LOGIN  
4. Huawei full E2E
