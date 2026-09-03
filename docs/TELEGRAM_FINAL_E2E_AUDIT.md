# Telegram Final E2E Audit

Evaluation: CODE → TEST → DEPLOYED → REAL TELEGRAM → EVIDENCE.

| Scenario | CODE | TEST | DEPLOYED | REAL | Evidence |
|----------|------|------|----------|------|----------|
| Screen parent map complete | PASS | PASS (`bot-screens.spec`) | pending | — | `SCREEN_PARENT` |
| Callback inventory includes admin:licenses | PASS | PASS | pending | — | inventory + handler |
| Role roots separated | PASS | existing | pending | owner | user vs admin keyboards |
| Regular denied on admin callback | PASS | inventory + early deny | pending | owner | `isAdminCallback` gate |
| Receipt exact orderId session | PASS | — | pending | owner | `PURCHASE_STEP.AWAITING_RECEIPT` |
| Support / receipt isolation | PASS | — | pending | owner | support checked before receipt |
| Device disconnect confirm | PASS | — | pending | owner | `licrev:confirm` → `do` |
| Admin licenses not dead | PASS | — | pending | SAFE Admin | `TelegramAdminLicensesBotService` |
| Admin arbitrary text no relay | PASS | — | pending | SAFE Admin | `adminChooseAction` |
| Deep-link OTP titles | PASS | — | pending | owner | Recovery/Link/Login |
| RU/TJ strings | PASS | i18n specs | pending | owner | ru.ts / tj.ts |
| Real regular full walk | — | — | — | BLOCKED | needs non-admin Telegram |
| Real admin SAFE nav | — | — | pending | pending | after deploy |
| Multi-user support routing | existing relay | existing | pending | BLOCKED | needs two users |

Dangerous production mutations (approve/reject/revoke/create/disconnect execute) are **not** part of default QA unless owner authorizes.
