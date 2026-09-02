# Ruznamo — Backend / Admin Launch Infrastructure Audit

Date: 2026-09-02  
Repository: `D:\Ruznamo-Backend`  
Block: Production data reset · Real device telemetry · APK release management · Admin RU/TJ

## Summary

| Area | Status | Notes |
|------|--------|-------|
| ADMIN RU | **PASS** | Primary navigation, system, updates, data reset in Russian |
| ADMIN TJ | **PARTIAL PASS** | Locale switcher + TJ for nav/system/updates/data-reset; legacy pages inherit RU structure via spread until full copyedit |
| REAL DEVICES | **PASS** | `DeviceInstallation` extended; admin list exposes manufacturer/model/version/locale/IP |
| REAL VERSION TELEMETRY | **PASS** | Sync on device register, refresh, entitlements; unknown ≠ `1.0.0` |
| UPDATE STORAGE | **READY (config required)** | S3-compatible object storage module; not on Vercel disk |
| APK VALIDATION | **PASS** | package, versionCode, SHA-256, signing block hash, optional allowed cert env |
| RELEASE ADMIN | **PASS** | `/api/v1/admin/releases` upload/draft/publish/archive/purge |
| ANDROID UPDATE API | **PASS** | `GET /api/v1/app/update?versionCode=&locale=` |
| RESET DRY RUN (production DB) | **EXECUTED (read-only)** | See counts below |
| RESET PASSWORD | **PASS** | Argon2id via `@node-rs/argon2`; min 12 chars; weak list blocked |
| PRODUCTION RESET EXECUTED | **NO** | Awaiting explicit human approval |
| DEPLOY SHA | **NOT DEPLOYED** | Local implementation only |
| TESTS | **177/177 PASS** | Backend Jest |

**RESULT: PASS (implementation)** — deploy + S3 env + production runtime verification still required.

---

## Production USER_DATA_RESET dry run (read-only)

Script: `scripts/production-data-reset-dry-run.ts`  
**No data was deleted.**

| Domain | Count |
|--------|------:|
| Users | 19 |
| Devices | 12 |
| Telegram accounts | 7 |
| Licenses | 6 |
| Activations | 4 |
| Orders | 11 |
| Receipts | 7 |
| Support conversations | 3 |
| Recovery sessions | 2 |
| Refresh tokens | 39 |
| Trial grants | 12 |

---

## Implemented backend

### Schema (`20260902210000_launch_infrastructure`)

- `AppRelease` — DRAFT / PUBLISHED / ARCHIVED / PURGED
- `SystemSecurityCredential` — `DATA_RESET` Argon2id hash
- `DeviceInstallation.appVersionName`, `appVersionCode`, `appLocale`

### Data reset

- `POST /api/v1/admin/system/data-reset/dry-run`
- `POST /api/v1/admin/system/data-reset/execute` (throttled)
- Scopes: `TEST_DATA_CLEANUP`, `USER_DATA_RESET`, `FACTORY_RESET`
- Confirmation phrase: `УДАЛИТЬ ВСЕ ДАННЫЕ`
- Preserves: admin RBAC, migrations, plans (USER reset), reset credential, system audit entries starting with `system.`

### App releases

- Upload → inspect APK → store in object storage → draft → publish
- Env: `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, optional `S3_PUBLIC_BASE_URL`, `ANDROID_PACKAGE_NAME`, `ANDROID_RELEASE_SIGNING_CERT_SHA256`

### Android update API

```
GET /api/v1/app/update?platform=ANDROID&versionCode=8&locale=ru
```

Compares `versionCode` only. Returns changelog by locale.

### Device telemetry

- Updated on: `POST /api/v1/auth/device/register`, `POST /api/v1/auth/refresh`, `GET /api/v1/me/entitlements` (query params), `POST /api/v1/devices/register`
- Same `installationId` → same row (no duplicate device on app update)

---

## Admin panel

- Navigation: Обзор · Лицензии · Устройства · Заказы · Аналитика · **Обновления** · Реквизиты · Система
- Header: **RU / TJ** switcher
- `/system/data` — data management + reset password + dry run + execute
- `/updates` — release overview, upload, publish

---

## Signing identity (launch critical)

Before mass APK distribution:

1. Fix **production signing key** (debug ≠ production update path).
2. Set `ANDROID_RELEASE_SIGNING_CERT_SHA256` to SHA-256 of `META-INF/*.RSA` signing block from a known-good release APK.
3. First published APK becomes the update identity for all installed devices with the same certificate.

---

## Required before production deploy

1. Apply migration to Neon: `npx prisma migrate deploy`
2. Configure S3/R2 object storage env on Vercel
3. Set `ANDROID_RELEASE_SIGNING_CERT_SHA256` after production keystore is finalized
4. Grant new permissions to admin roles (migration inserts for SUPER_ADMIN/ADMIN)
5. Initialize data reset password in Admin → Система → Управление данными
6. Review dry run counts above → **explicit approval** before USER_DATA_RESET

---

## Android follow-up (separate repo)

After API deploy:

- Send real `installationId`, manufacturer, model, `versionName`, `versionCode`, locale on startup/sync
- Call `GET /api/v1/app/update`
- DownloadManager + SHA-256 verify + system Package Installer
- Settings → «Проверить обновления»

---

## Not executed

- Production `USER_DATA_RESET` / `FACTORY_RESET`
- Production APK upload
- Vercel deploy of this block
