# Telegram Final Interaction Map

Serverless-safe navigation for `@Ruznamo_bot`. Session state: Postgres `TelegramBotSession`. Role: ACTIVE `AdminTelegramIdentity` via `AdminTelegramAuthService`.

## 1. Regular User tree

```
USER_ROOT
├── USER_BUY_STANDARD → USER_BUY_PERIOD → USER_BUY_PAYMENT_METHOD → AWAITING_PAYMENT_RECEIPT
│                         └── USER_BUY_PENDING_REENTRY (continue / cancel / new)
├── USER_LICENSES_LIST → USER_LICENSE_DETAIL → USER_LICENSE_DEVICES → USER_DEVICE_DETAIL
│                                                     └── USER_DEVICE_DISCONNECT_CONFIRM
├── USER_RECOVERY_INSTRUCTION
├── USER_LANGUAGE
├── USER_SUPPORT_CATEGORY → SUPPORT_ACTIVE → USER_SUPPORT_CLOSE_CONFIRM
└── USER_INSTRUCTION_ROOT → USER_INSTRUCTION_ARTICLE
```

## 2. Admin tree

```
ADMIN_ROOT
├── ADMIN_ORDERS_LIST → ADMIN_ORDER_DETAIL → approve/reject confirms
├── ADMIN_PAYMENT_METHODS_LIST → detail → edit wizard
├── ADMIN_SUPPORT_LIST → ADMIN_SUPPORT_CONVERSATION → ADMIN_SUPPORT_REPLY
├── ADMIN_LICENSES_LIST → ADMIN_LICENSE_DETAIL → devices / revoke confirm
├── ADMIN_CREATE_LICENSE_PLAN → DURATION → CONFIRM → SUCCESS
└── ADMIN_LANGUAGE
```

## 3. Deep-link tree

```
start=auth_* → language if needed → AUTH_RECOVERY | AUTH_LINK_ACCOUNT | AUTH_LOGIN (OTP)
start=lic_* / repl_* → confirm screens
Invalid/expired → natural message + Home
```

## 4–6. State / Back / Home

Canonical parent map: `src/telegram/nav/bot-screens.ts` (`SCREEN_PARENT`).

| Screen | Back | Home |
|--------|------|------|
| USER_ROOT / ADMIN_ROOT | — | — |
| USER_BUY_STANDARD | USER_ROOT | USER_ROOT |
| AWAITING_PAYMENT_RECEIPT | payment summary / methods | USER_ROOT |
| USER_LICENSE_DETAIL | USER_LICENSES_LIST | USER_ROOT |
| USER_DEVICE_DISCONNECT_CONFIRM | USER_DEVICE_DETAIL | USER_ROOT |
| SUPPORT_ACTIVE | close confirm (not silent exit) | — |
| ADMIN_LICENSES_LIST | ADMIN_ROOT | ADMIN_ROOT |
| ADMIN_* | per SCREEN_PARENT | ADMIN_ROOT |

## 7–8. Input

| State | Accepted | Invalid |
|-------|----------|---------|
| menus | buttons | «Выберите действие кнопками» + re-render |
| AWAITING_PAYMENT_RECEIPT | photo/document | text → receipt hint |
| SUPPORT_ACTIVE | text/photo/document | — (routed to conversation) |
| ADMIN_SUPPORT_REPLY | text/photo/document | — |
| Admin idle | buttons | «Выберите действие кнопками» + Admin panel |

## 9. Authorization

- Admin callbacks: `isTelegramAdmin` on every privileged action
- User resources: holder/purchaser/ownership re-checked in handlers
- `callback_data` is not authorization

## 10. Mutations / idempotency

- Order approve/reject via existing `PaymentApprovalService`
- Receipt submit deduped by `telegramUpdateId`
- Device disconnect: confirm then `revokeDeviceAsHolder`
- Manual license: `LicenseIssuanceService`
- Pending purchase re-entry avoids silent duplicate orders

## 11–12. Labels

RU/TJ dictionaries: `src/telegram/i18n/ru.ts`, `tj.ts`. Plan names stay **Standard / Pro / Pro Plus**.
