# Full Production Recovery Checklist

**Updated:** 2026-09-02 (revised — honest statuses)

Status values: `NOT STARTED` | `IN PROGRESS` | `CODE DONE` | `DEPLOYED` | `VERIFIED` | `BLOCKED` | `NEEDS HUMAN QA`

| Phase | Area | Status | Notes |
|-------|------|--------|-------|
| 1 | Deployment truth | VERIFIED | `6e0209c` on origin/main |
| 2 | Schema drift / migrate deploy | VERIFIED | 2 migrations applied; P2022 resolved |
| 3 | Backend health | VERIFIED | /health + /ready 200 |
| 4 | Telegram webhook transport | DEPLOYED | 401/200 probes OK; synthetic /start 200 |
| 4b | Telegram user-visible reply | NEEDS HUMAN QA | Real /start in chat |
| 5–6 | Telegram nav + language | CODE DONE | Reply keyboard + TJ/RU |
| 7–8 | Plan commercial state (DB) | VERIFIED | STANDARD ON, PRO OFF |
| 9 | Admin tariffs UI | NEEDS HUMAN QA | Toggle + persistence unverified |
| 10–11 | Plan period UX | CODE DONE | PlanPrice-driven |
| 12 | Payment Orders API | VERIFIED | No Prisma error post-migrate |
| 13 | Payment Orders UI | NEEDS HUMAN QA | Login required |
| 14–16 | PaymentMethod architecture | DEPLOYED | **0 rows in prod** — config pending |
| 14b | Payment requisites config | NEEDS HUMAN QA | Admin Telegram 💳 Реквизиты |
| 17–20 | Receipt / approval / rejection | CODE DONE | Full E2E pending |
| 21–23 | Duration / multi-license | CODE DONE | E2E pending |
| 28 | Unified admin journey | CODE DONE | Order detail exists |
| 29–30 | Test data cleanup | **NEEDS HUMAN CLASSIFICATION** | Dry-run 0 deterministic; heuristics flag likely test rows |
| 32–36 | Admin profile | NEEDS HUMAN QA | displayName save → F5 |
| 37–42 | System page | NEEDS HUMAN QA | Real versions in DB; page unopened |
| 43–47 | Analytics + audit | NEEDS HUMAN QA | Code done |
| 51–53 | Tests + build | VERIFIED | 135 backend; admin build OK |
| 54 | Commit / push / deploy | VERIFIED | Pushed to main |
| 55 | Admin screen-by-screen QA | NOT STARTED | Waiting on human login |
| 56 | Telegram purchase E2E | NOT STARTED | After requisites + /start verified |
| 57 | Multi-license E2E | NOT STARTED | |
| 58 | Admin ↔ license ↔ device E2E | PARTIAL | DB journeys only |
| 63–64 | Final report | VERIFIED | Revised PRODUCTION_RECOVERY_REPORT.md |

## Human QA gate (do before next code block)

- [ ] Заявки на оплату — no red error
- [ ] Telegram /start — real reply
- [ ] Купить — Standard only
- [ ] Тарифы — Standard ON, Pro OFF in UI
- [ ] Система — real version distribution
- [ ] Профиль — displayName persists after F5
- [ ] 💳 Реквизиты — at least one PaymentMethod created
- [ ] Full purchase E2E (receipt → approve → key)
- [ ] Users / Devices / Licenses / Audit — mark test IDs for cleanup
