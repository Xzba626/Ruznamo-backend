# PHASE 0 — Requirements Audit / Ruznamo Backend

> Status: COMPLETE (planning only — no application code yet)  
> Date: 2026-08-30  
> Target folder: `D:\Ruznamo-Backend`

---

## 0.1 Project goal

Build a **production-oriented** backend for the commercial Android app **Ruznamo**:

- REST API (`/api/v1/...`) as the **single source of truth** for accounts, licenses, entitlements, orders, and configuration
- PostgreSQL + Prisma
- JWT auth with refresh-token rotation
- Two Telegram bots (user + admin)
- Admin API for a future Tile Admin / Tailwind panel
- Docker Compose for local development
- OpenAPI/Swagger contract for Android integration

Android remains **offline-first** with local Room DB; backend validates commercial rights and account state.

---

## 0.2 Functional scope (backend modules)

| Module | Responsibility |
|--------|----------------|
| `health` | Liveness/readiness, DB connectivity |
| `auth` | Access/refresh JWT, rotation, revocation, sessions |
| `users` | User profile, category, status |
| `devices` | Installation ID tracking, limits, revocation |
| `plans` | Plan catalog (STANDARD now; PRO/PRO_PLUS later) |
| `entitlements` | Centralized feature resolution per user/plan |
| `licenses` | Key generation, activation, expiration, events |
| `orders` | Purchase flow, state machine |
| `payments` | Receipt handling, approval orchestration |
| `telegram` | User bot, admin bot, account linking |
| `admin` | Dashboard + CRUD + approvals |
| `audit` | Immutable audit trail |
| `app-config` | Version policy, maintenance mode, public config |
| `notifications` | Internal event hooks (Telegram delivery) |
| `common` | Errors, request ID, validation, guards, crypto utils |
| `security` | Rate limits, CORS, headers, RBAC |

---

## 0.3 Out of scope (current phase)

- Admin Panel frontend (API only)
- Pro / Pro Plus sales UI
- Redis / message queues (unless rate-limit scale requires later)
- Cloud sync implementation (entitlement flag only for future)
- Direct Android ↔ PostgreSQL access (forbidden)
- IMEI / advertising ID collection

---

## 0.4 Skills / tooling audit (Cursor)

| Skill | Relevance | Action |
|-------|-----------|--------|
| `create-rule` | Project conventions, API standards | Use in PHASE 2+ |
| `new-repo` / `origin` | GitHub connect later | Defer until repo exists |
| `review-security` | Before production | PHASE 8 |
| `review-bugbot` | Per implementation block | After each phase |
| NestJS/Prisma skills | Not present as dedicated skill | Use official docs + this plan |

No blocking missing skills for PHASE 0–1.

---

## 0.5 Runtime & dependency versions (audited 2026-08-30)

| Component | Recommended | Notes |
|-----------|-------------|-------|
| Node.js | **20.20 LTS** (installed) | NestJS 12 requires ≥20.19 |
| TypeScript | ^5.7 | Strict mode |
| NestJS | **11.x stable** or **12.x** | 12.0.1 latest; 11.x safer for Prisma ecosystem today |
| Prisma | **6.x stable** | 8.0.0-rc available — avoid RC for production baseline |
| PostgreSQL | **16** | Via Docker Compose |
| `@prisma/adapter-pg` | latest matching Prisma | Required for Prisma 6+ driver adapter pattern |
| `pg` | ^8 | PostgreSQL driver |
| `@nestjs/jwt` `@nestjs/passport` | match Nest major | Auth |
| `passport-jwt` | ^4 | JWT strategy |
| `bcrypt` or `argon2` | argon2 preferred | Admin password hashing |
| `class-validator` `class-transformer` | latest | DTO validation |
| `@nestjs/swagger` | match Nest major | OpenAPI |
| `@nestjs/throttler` | latest | In-memory rate limiting (no Redis initially) |
| `helmet` | latest | Security headers |
| `grammy` | 1.46+ | Telegram bots (TypeScript-first) |
| `nestjs-pino` or `pino` | latest | Structured logging |
| `uuid` | ^11 | Request IDs |
| `jest` `supertest` `@nestjs/testing` | match Nest | Tests |

**Decision:** Start with **NestJS 11 + Prisma 6** for maximum stability; upgrade to Nest 12 / Prisma 7+ in a dedicated migration step after MVP passes tests.

---

## 0.6 Android alignment status

- Android source **not available** in this workspace.
- API contract is designed from MASTER TASK requirements + standard mobile patterns.
- **Assumption list** (validate against Android before PHASE 3):

| # | Assumption | Risk if wrong |
|---|------------|---------------|
| A1 | Android generates `installationId` as UUID v4 on first launch | Device tracking breaks |
| A2 | Android calls backend on launch + license check + entitlement sync | Wrong sync cadence |
| A3 | User category enum matches exactly | Mapping layer needed |
| A4 | Trial is server-controlled with limited horizon | Trial abuse logic wrong |
| A5 | License key entered manually OR restored via Telegram link | UX flow mismatch |
| A6 | All API timestamps in **ISO 8601 UTC** (`2026-08-30T10:00:00.000Z`) | Parsing bugs |
| A7 | API language for user messages: Tajik primary | i18n structure needed |

---

## 0.7 Open questions (need product decision before implementation)

### Q1 — Trial definition
MASTER TASK mentions anti-trial-abuse but does not define:
- Trial duration (e.g. 7 / 14 / 28 days?)
- Trial entitlements vs STANDARD entitlements
- Whether trial requires Telegram or only Installation ID

**Proposed default:** 14-day trial, same planning horizon as STANDARD (28 days), `max_devices=1`, one trial per `installationId` globally, optional Telegram not required for trial.

### Q2 — Android initial auth
Two valid patterns:
- **(A)** Device-first: register installation → JWT → optional Telegram → license
- **(B)** License-first: enter key → create/link user

**Proposed default:** **(A) Device-first** — supports trial abuse prevention and Telegram restore.

### Q3 — Admin panel auth
Separate `AdminUser` table with email/password, or Telegram-only admin?

**Proposed default:** `AdminUser` with email + password + optional Telegram ID for admin bot notifications.

### Q4 — Payment instructions
Static text in config vs per-order dynamic instructions?

**Proposed default:** `SystemConfig` keys for payment instructions (bank/card details), editable via Admin API.

---

## 0.8 Non-functional requirements

| Area | Requirement |
|------|-------------|
| Security | No secrets in Git; hash refresh tokens; hash license keys |
| Idempotency | Activation, approval, refresh rotation, Telegram callbacks |
| Observability | Structured JSON logs + `requestId` |
| Errors | Unified `{ success, error, requestId }` envelope |
| Timezone | Store UTC in DB; API returns UTC ISO strings |
| Concurrency | Transaction-safe order approval + license creation |
| Tests | Unit + integration + e2e for 15 critical flows listed in MASTER TASK |

---

## 0.9 PHASE 0 checklist

- [x] Requirements analyzed
- [x] Module list defined
- [x] Skills checked
- [x] Library versions audited
- [x] Dependency list formed
- [x] Android assumptions documented
- [x] Open questions flagged
- [ ] Android project cross-check (pending access)
- [ ] Product answers to Q1–Q4 (pending stakeholder)

---

## 0.10 Implementation dependency graph

```
PHASE 2  Database (Prisma schema + migration)
    ↓
PHASE 3  Core API (health, auth, users, devices, licenses, plans, entitlements)
    ↓
PHASE 4  Telegram (user bot, linking)
    ↓
PHASE 5  Orders + receipts + approval
    ↓
PHASE 6  License crypto + activation hardening
    ↓
PHASE 7  Admin API
    ↓
PHASE 8  Security review
    ↓
PHASE 9  Tests
    ↓
PHASE 10 Android contract verification
    ↓
PHASE 11 Final audit
```
