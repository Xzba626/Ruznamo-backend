# Android Integration Gaps

> Generated from implementation audit. Update as blocks are completed.

## Path prefix — RESOLVED (BLOCK 1.1)

All Android business endpoints are under `/api/v1/...`. Health probes remain at `/health` (no version prefix).

See `docs/API-CONTRACT.md` routing rules.

## `GET /api/v1/app/config` — RESOLVED (BLOCK 1.1)

| Field | Status |
|-------|--------|
| `configVersion` | ✅ |
| `updateRequired` | ✅ |
| `updateRecommended` | ✅ |

## Unimplemented Android-critical endpoints

All blocked until respective implementation blocks:

- Device registration → BLOCK 2
- Entitlements → BLOCK 3
- License activation → BLOCK 3
- Telegram linking → BLOCK 5

## Android source unavailable

Cannot verify Room entity enums match `UserCategory` Prisma enum without access to `D:\Ruznamo` Android project.

**Action:** Cross-check before production Android release.

## Offline-first contract

Android may cache `GET /me/entitlements` response. Backend must:

- Return stable JSON schema (version via `configVersion` when added)
- Use ISO 8601 UTC timestamps
- Never require sync for local schedule data (out of scope for backend)
