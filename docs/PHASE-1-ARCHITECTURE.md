# PHASE 1 — Architecture / Ruznamo Backend

> Status: COMPLETE (design only)  
> Companion: `API-CONTRACT.md`, `DATABASE-SCHEMA.md`

---

## 1. Proposed architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Clients                                   │
├──────────────┬────────────────────┬─────────────────────────────┤
│ Android App  │  Admin Panel (web) │  Telegram User / Admin Bots │
└──────┬───────┴─────────┬──────────┴──────────────┬──────────────┘
       │ HTTPS            │ HTTPS                    │ Telegram API
       ▼                  ▼                          ▼
┌──────────────────────────────────────────────────────────────────┐
│                     Ruznamo API (NestJS)                          │
│  ┌─────────┐ ┌────────┐ ┌─────────┐ ┌──────────┐ ┌───────────┐ │
│  │  Auth   │ │ Users  │ │ Devices │ │ Licenses │ │Entitlements│ │
│  └─────────┘ └────────┘ └─────────┘ └──────────┘ └───────────┘ │
│  ┌─────────┐ ┌────────┐ ┌─────────┐ ┌──────────┐ ┌───────────┐ │
│  │ Orders  │ │Receipts│ │Telegram │ │  Admin   │ │   Audit   │ │
│  └─────────┘ └────────┘ └─────────┘ └──────────┘ └───────────┘ │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Common: guards, filters, interceptors, crypto, state machines ││
│  └─────────────────────────────────────────────────────────────┘│
└───────────────────────────────┬──────────────────────────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │     PostgreSQL 16      │
                    └───────────────────────┘
```

### Architectural principles

1. **Server is source of truth** for license status, entitlements, device limits, trial eligibility.
2. **Centralized entitlements** — no scattered `if (plan === STANDARD)` in controllers.
3. **Explicit state machines** for `Order` and `License` — illegal transitions rejected in domain services.
4. **Idempotent writes** for activation, approval, token refresh.
5. **Modular monolith** — one deployable NestJS app; clear module boundaries for future extraction.
6. **Android contract first** — every public endpoint documented in OpenAPI before merge.

---

## 2. Folder structure

```
D:\Ruznamo-Backend\
├── docker-compose.yml
├── Dockerfile
├── .env.example
├── .gitignore
├── package.json
├── nest-cli.json
├── tsconfig.json
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts                 # STANDARD plan, features, default config
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── config/                 # env validation (Zod or @nestjs/config + Joi)
│   ├── common/
│   │   ├── decorators/
│   │   ├── dto/
│   │   ├── filters/            # Global exception filter
│   │   ├── guards/
│   │   ├── interceptors/       # RequestId, logging
│   │   ├── pipes/
│   │   ├── crypto/             # license key, token hashing
│   │   ├── state-machine/      # order + license transitions
│   │   └── utils/
│   ├── prisma/
│   │   ├── prisma.module.ts
│   │   └── prisma.service.ts
│   ├── health/
│   ├── auth/
│   │   ├── strategies/
│   │   ├── dto/
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   └── refresh-token.service.ts
│   ├── users/
│   ├── devices/
│   ├── plans/
│   ├── entitlements/
│   ├── licenses/
│   ├── orders/
│   ├── receipts/
│   ├── payments/               # approval orchestration
│   ├── telegram/
│   │   ├── user-bot/
│   │   ├── admin-bot/
│   │   └── linking/
│   ├── admin/
│   │   ├── dashboard/
│   │   ├── users/
│   │   ├── licenses/
│   │   ├── orders/
│   │   └── audit/
│   ├── app-config/
│   ├── audit/
│   └── i18n/                   # Tajik message templates
├── test/
│   ├── e2e/
│   ├── integration/
│   └── fixtures/
└── docs/
    ├── PHASE-0-REQUIREMENTS-AUDIT.md
    ├── PHASE-1-ARCHITECTURE.md
    ├── API-CONTRACT.md
    ├── DATABASE-SCHEMA.md
    └── FLOWS.md
```

---

## 3. Database entities (summary)

See `DATABASE-SCHEMA.md` for full Prisma-oriented design.

| Entity | Purpose |
|--------|---------|
| `User` | End-user account (Android) |
| `TelegramAccount` | Linked Telegram identity (`telegramId` unique) |
| `TelegramLinkToken` | Short-lived linking codes |
| `DeviceInstallation` | Android installation UUID tracking |
| `Plan` | STANDARD / PRO / PRO_PLUS catalog |
| `PlanPrice` | Monthly/yearly pricing per plan |
| `PlanFeature` | Feature key-value per plan |
| `License` | Entitlement grant (hashed key) |
| `LicenseActivation` | Device activation record |
| `LicenseEvent` | Status change history |
| `TrialGrant` | Anti-abuse trial tracking per installation |
| `Order` | Purchase transaction |
| `Receipt` | Payment proof from Telegram |
| `RefreshToken` | Hashed refresh token sessions |
| `AdminUser` | Admin panel operators |
| `Role` / `Permission` / `AdminUserRole` | RBAC |
| `AuditLog` | Security & admin actions |
| `AppVersion` | Android version policy |
| `SystemConfig` | Key-value runtime config |
| `IdempotencyKey` | Duplicate-safe operations |

---

## 4. API endpoint map (high level)

### Public / Android (`/api/v1`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | None | Liveness |
| GET | `/health/ready` | None | DB readiness |
| GET | `/app/config` | None | Version + maintenance |
| POST | `/auth/device/register` | None | First launch / reinstall |
| POST | `/auth/refresh` | Refresh | Rotate tokens |
| POST | `/auth/logout` | Access | Revoke current session |
| POST | `/auth/logout-all` | Access | Revoke all sessions |
| GET | `/account` | Access | Profile + linked Telegram |
| PATCH | `/account` | Access | Update displayName, category |
| GET | `/me/entitlements` | Access | **Primary Android sync endpoint** |
| POST | `/licenses/activate` | Access | Activate license key |
| GET | `/licenses/me` | Access | Current license summary |
| GET | `/devices` | Access | List devices |
| POST | `/devices/register` | Access | Register/update device metadata |
| POST | `/devices/revoke` | Access | Revoke device |
| POST | `/telegram/link/start` | Access | Start linking flow |
| GET | `/telegram/link/status` | Access | Poll linking status |

### Admin (`/api/v1/admin`)

| Area | Endpoints |
|------|-----------|
| Auth | `POST /admin/auth/login`, `POST /admin/auth/refresh`, `POST /admin/auth/logout` |
| Dashboard | `GET /admin/dashboard/summary` |
| Users | CRUD + suspend/activate + nested devices/licenses/orders |
| Licenses | search, create, revoke, suspend, activate, extend, events |
| Orders | list, filter, inspect, approve, reject |
| Receipts | view metadata + Telegram file proxy |
| Audit | search + filter |
| Config | app versions, system config, payment instructions |

Full request/response schemas: `API-CONTRACT.md`.

---

## 5. Authentication flow

### 5.1 Device-first registration (Android first launch)

```
Android                          Backend
   │                                │
   │ POST /auth/device/register     │
   │ { installationId, platform,   │
   │   appVersion, deviceName,       │
   │   category? }                  │
   ├───────────────────────────────►│
   │                                │ Find DeviceInstallation by installationId
   │                                │ If exists → attach to existing User
   │                                │ If new → create User + Device + TrialGrant?
   │                                │ Issue access JWT (15m) + refresh (30d)
   │                                │ Store refresh token hash
   │◄───────────────────────────────┤
   │ { accessToken, refreshToken,   │
   │   expiresIn, user, trial? }    │
```

### 5.2 Token refresh (rotation)

```
Client → POST /auth/refresh { refreshToken }
Server:
  1. Hash incoming token, lookup RefreshToken row
  2. If revoked/expired → 401
  3. Revoke old row (rotation)
  4. Issue new pair
  5. Store new hash
```

### 5.3 Admin auth

- Email + password (Argon2id hash)
- Separate JWT issuer/audience claim: `aud: "admin"`
- Same refresh rotation mechanics, separate `AdminRefreshToken` table or shared with `subjectType` discriminator

### 5.4 Token storage rules

| Token | Client | Server |
|-------|--------|--------|
| Access JWT | Android EncryptedSharedPreferences | Stateless verify |
| Refresh | Secure storage | **Hash only** (SHA-256 or HMAC) |
| License key | User input only | **Hash only** (HMAC-SHA256 with pepper) |

---

## 6. License flow

### 6.1 Key generation (on payment approval)

```
Format: RZNM-XXXX-XXXX-XXXX-XXXX  ( Crockford Base32, 20 chars random )
Store:
  - keyHash = HMAC_SHA256(pepper, normalizedKey)
  - keyPrefix = first 8 chars (for admin search/display)
  - status = PENDING (until activated or directly ACTIVE if pre-assigned)
```

### 6.2 Activation

```
POST /licenses/activate
Authorization: Bearer <access>
Idempotency-Key: <uuid>
Body: { licenseKey, installationId, deviceName?, appVersion? }

Checks (transaction):
  1. Normalize + hash key → find License
  2. Verify hash
  3. Status allows activation
  4. Not expired
  5. userId null OR matches current user
  6. Device limit via EntitlementService (STANDARD: max 1 active)
  7. Upsert DeviceInstallation
  8. Create LicenseActivation (unique licenseId+deviceId)
  9. Set license.userId, status ACTIVE, activatedAt
  10. Write LicenseEvent + AuditLog
  11. Return entitlements snapshot
```

### 6.3 Ongoing validation (Android)

Android calls `GET /me/entitlements` on schedule:
- Returns `license.status`, `expiresAt`, `features`, `deviceLimit`, `activeDevices`
- Android caches locally but **must re-check** for commercial features

---

## 7. Telegram flow

### 7.1 User bot (payment)

```
/start → resolve TelegramAccount → find/create User link
      → show STANDARD plan
      → inline keyboard: 1 month / 1 year
      → create Order (PENDING)
      → send payment instructions (from SystemConfig)
      → wait for photo/document (receipt)
      → create Receipt, Order → RECEIPT_SUBMITTED
      → notify Admin Bot
```

### 7.2 Admin bot

```
On new receipt:
  → message with order summary + inline [Approve] [Reject]
Approve:
  → call PaymentApprovalService (same as Admin API approve)
  → idempotent by orderId
  → send license key to user via User Bot
Reject:
  → prompt reason → Order REJECTED → notify user
```

### 7.3 Account linking (Android ↔ Telegram)

```
Android: POST /telegram/link/start → { linkCode, expiresAt, deepLink }
User Bot: /link <code> or start param
Backend:
  → validate code, bind TelegramAccount to User
  → if Telegram user already has active license → entitlements available on Android
Android: GET /telegram/link/status → linked: true
```

---

## 8. Payment / order flow

```
PENDING
  → user selects plan in bot → still PENDING (amount set)
  → receipt uploaded → RECEIPT_SUBMITTED
  → admin opens review → UNDER_REVIEW
  → APPROVED → (PaymentApprovalService)
       → create License
       → Order → COMPLETED
  → REJECTED (from UNDER_REVIEW or RECEIPT_SUBMITTED)
  → CANCELLED (user/admin cancel from PENDING)
```

**PaymentApprovalService** (single entry point):
- Used by Admin API and Admin Telegram Bot
- Wrapped in DB transaction
- Idempotency key = `order-approve:{orderId}`

---

## 9. Admin API structure

```
AdminModule
├── AdminAuthModule
├── AdminDashboardModule      # aggregates: counts, revenue, recent audit
├── AdminUsersModule
├── AdminLicensesModule
├── AdminOrdersModule
├── AdminAuditModule
├── AdminConfigModule         # SystemConfig + AppVersion
└── AdminPermissionsGuard     # centralized RBAC
```

### Roles

| Role | Permissions |
|------|-------------|
| `SUPER_ADMIN` | `*` |
| `ADMIN` | users:*, licenses:*, orders:approve, orders:reject, dashboard:read |
| `SUPPORT` | users:read, licenses:read, orders:read, orders:approve (optional flag) |

Permissions stored as `permission.code` strings; `@RequirePermissions()` decorator.

---

## 10. Security model

| Layer | Mechanism |
|-------|-----------|
| Transport | HTTPS only in production |
| Headers | Helmet, CORS whitelist from `CORS_ORIGINS` |
| Rate limit | `@nestjs/throttler` — stricter on auth + activation |
| Input | `class-validator` DTOs, whitelist mode |
| SQL | Prisma parameterized queries |
| Auth | JWT access + rotated refresh |
| AuthZ | Guards: `JwtAuthGuard`, `AdminAuthGuard`, `PermissionsGuard` |
| Secrets | `.env` only; `LICENSE_KEY_PEPPER`, `JWT_*` |
| Logging | Pino JSON; redact `authorization`, `licenseKey`, tokens |
| Errors | No stack traces in production |
| Admin | RBAC + audit on every mutation |
| Telegram | Validate `X-Telegram-Bot-Api-Secret-Token` on webhook (if webhooks used) |

### Anti-abuse

| Vector | Mitigation |
|--------|------------|
| Reinstall trial | `TrialGrant.installationId` unique; reuse returns existing trial state |
| Multiple devices | `max_devices` from entitlements |
| License key brute force | Rate limit + constant-time hash compare |
| Duplicate approval | Idempotency + order state machine |
| Token theft | Short access TTL + refresh rotation + revocation |

---

## 11. Entitlements system

```typescript
// EntitlementService.resolveForUser(userId)
{
  user: { id, category, status },
  plan: { code: "STANDARD", name },
  license: { status, expiresAt, keyPrefix } | null,
  trial: { active, expiresAt } | null,
  features: {
    planning_horizon_days: 28,
    max_devices: 1,
    cloud_sync: false,
    advanced_analytics: false
  },
  devices: { active: 1, limit: 1 },
  effectiveStatus: "ACTIVE" | "TRIAL" | "EXPIRED" | "NONE"
}
```

Resolution order:
1. Active paid license (not expired/revoked)
2. Else active trial
3. Else free/none with base restrictions

---

## 12. Testing strategy

| Layer | Tool | Focus |
|-------|------|-------|
| Unit | Jest | State machines, entitlement resolver, key hashing |
| Integration | Jest + test DB | Prisma repositories, approval transaction |
| E2E | Supertest | Full HTTP flows |

### Critical e2e scenarios (from MASTER TASK)

1. Device register → user created
2. Telegram link
3. Order creation via bot (mocked Telegram update)
4. Receipt submission
5. Admin approve → license created
6. License activation
7. Re-activation (idempotent)
8. Expired license → 403 on entitlements
9. Revoked license
10. Device limit exceeded
11. Unauthorized → 401
12. Forbidden admin → 403
13. Duplicate approve → single license
14. Duplicate activation → single activation
15. Refresh rotation + revoked refresh fails

Test DB: Docker PostgreSQL + `prisma migrate reset` per suite.

---

## 13. Implementation roadmap (post-approval)

| Block | Deliverable | Est. |
|-------|-------------|------|
| **BLOCK 1** | Project scaffold, Docker, Prisma schema, seed, health | 1 session |
| **BLOCK 2** | Auth + devices + users | 1 session |
| **BLOCK 3** | Plans + entitlements + licenses (no Telegram) | 1 session |
| **BLOCK 4** | Orders + receipts + approval service | 1 session |
| **BLOCK 5** | Telegram user + admin bots | 1 session |
| **BLOCK 6** | Admin API | 1 session |
| **BLOCK 7** | Security hardening + audit | 1 session |
| **BLOCK 8** | Tests + OpenAPI polish + README | 1 session |

Each block: implement → typecheck → lint → test → review before next.

---

## 14. Contradictions / resolutions

| Issue | Resolution |
|-------|------------|
| Trial mentioned but not fully specified | Documented as Q1 in PHASE 0; default 14-day proposed |
| `GET /account` vs `GET /me/entitlements` | Both: account = profile; entitlements = commercial rights |
| Redis for rate limit | Use in-memory throttler first; document Redis upgrade path |
| Prisma 8 RC vs stable | Use Prisma 6.x for MVP |
