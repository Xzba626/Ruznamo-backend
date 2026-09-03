# Telegram Admin — Production Recovery Plan (pre-E2E)

Date: 2026-09-03  
Scope: non-destructive design proof before controlled disconnect E2E.

## Authority model

| Rule | Behavior |
|------|----------|
| DB after init | Only `AdminTelegramIdentity` with `ACTIVE` + `isVerified` grants bot admin |
| Env | `ADMIN_TELEGRAM_IDS` used **only** when management was never initialized (zero identities AND zero revoked IDs) |
| Disconnect last ACTIVE | Leaves REVOKED identity + `AdminTelegramRevokedId` → **initialized stays true** → env **cannot** resurrect |
| Same Telegram reconnect | Rebind/connect activates identity and **deletes** that ID from `AdminTelegramRevokedId` |
| Replaced Telegram | Old ID remains on revoke list permanently |

Code: `AdminTelegramAuthService` (`src/admin/telegram/admin-telegram-auth.service.ts`),  
`AdminTelegramService.disconnectTelegram` / `verifyTelegramRebind` / `tryCompleteLinkFromBot`.

## Happy path after successful disconnect

1. Owner remains logged into **Web Admin** (email/password JWT — independent of Telegram).
2. Profile → Telegram Admin → **Сменить / Connect** → enter Admin password → `POST /api/v1/admin/telegram/rebind/start`.
3. Open bot deep link → bot issues OTP → `POST .../rebind/verify` with OTP.
4. New (or same) Telegram becomes ACTIVE; bot admin restored via DB.

Alternative (legacy, weaker): `/telegram` → `POST .../connect` (RZ code, no password). Prefer Profile rebind.

## Failure matrix

| Failure | Remaining state | Recovery |
|---------|-----------------|----------|
| Disconnect succeeds | Zero ACTIVE Telegram admins; Web Admin intact; env denied | Rebind from Profile with password |
| OTP wrong / expired | Challenge unused or expired; identity still REVOKED | Start a **fresh** rebind challenge (new password confirmation) |
| Halfway after start, before OTP | Challenge expires in 5 minutes; no ACTIVE binding | Fresh rebind/start; Web Admin still works |
| Backend restart with zero ACTIVE | Env still denied (identity/revoked history) | Same Web Admin rebind |
| New Telegram OTP fails | Old ID still revoked; no ACTIVE | Retry rebind; optionally different Telegram |
| Web Admin session lost | Login with email/password | Then rebind |

**Normal recovery does not require direct DB edits.**

## Lockout prevention

- Web Admin access never depends on Telegram binding.
- Password is required for disconnect and rebind/start.
- Env resurrection after init: **IMPOSSIBLE** (covered by unit tests).
- Same-ID reconnect after disconnect: possible because successful bind clears that ID from `AdminTelegramRevokedId`.

## Controlled E2E (owner authorization required later)

Only after this design is accepted:

1. Confirm Web Admin session + backup password known.
2. Disconnect with password.
3. Verify bot denies old Telegram.
4. Rebind same or new Telegram via Profile.
5. Verify bot admin restored + status ACTIVE in UI.
