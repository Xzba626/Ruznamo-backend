# Full Production Recovery Checklist

**Updated:** 2026-09-01 (recovery pass)

| Phase | Area | Status | Notes |
|-------|------|--------|-------|
| 1 | Deployment truth | VERIFIED | LOCAL=REMOTE=fc64095; admin bundle matched before this push |
| 2 | Schema drift / migrate deploy | VERIFIED | 2 migrations applied to Neon |
| 3 | Backend health | VERIFIED | /health + /ready 200, DB up |
| 4 | Telegram P0 recovery | DEPLOYED | Webhook 200 with secret; last_error may be stale pre-migrate |
| 5 | Telegram main navigation | CODE DONE | Reply keyboard in processor |
| 6 | Telegram language | CODE DONE | TJ/RU i18n |
| 7–8 | Plan/price + commercial state | VERIFIED | STANDARD active, PRO inactive in DB |
| 9 | Admin tariffs | DEPLOYED | plans perms applied to DB; UI in bundle |
| 10–11 | Plan period + UX | CODE DONE | PlanPrice-driven durations |
| 12–13 | Payment Orders API + UI | DEPLOYED | Schema fixed; payment method column added |
| 14–16 | Payment requisites | CODE DONE | PaymentMethod + Telegram admin wizard |
| 17–20 | Receipt/support/approval | CODE DONE | existing services |
| 21–23 | Duration / licenses | CODE DONE | billingPeriod chain |
| 28 | Unified admin journey | CODE DONE | order detail with activations |
| 29–31 | Test data cleanup | VERIFIED | dry-run 0 confirmed test rows |
| 32–36 | Admin profile | CODE DONE | displayName PATCH + UI |
| 37–42 | System page | CODE DONE | real DB/device versions |
| 43–47 | Analytics + audit | CODE DONE | analytics page in admin bundle |
| 51–53 | Tests + build | VERIFIED | 135 backend tests; admin build OK |
| 54 | Commit / push / deploy | IN PROGRESS | this commit |
| 55 | Human-like Admin QA | BLOCKED | no admin password in audit session |
| 56–59 | Telegram/Plan E2E | PARTIAL | webhook probes only |
| 63–64 | Final report | IN PROGRESS | PRODUCTION_RECOVERY_REPORT.md |
