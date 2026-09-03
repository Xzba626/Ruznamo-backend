# System State & Data Lineage Audit

Date: 2026-09-03  
Repository: `D:\Ruznamo-Backend`  
Migration: `20260903090000_license_activation_slot_model` (**applied on production Neon**)

## Evidence policy

Claims require: CODE → TEST → DEPLOYED → REAL RUNTIME → EVIDENCE.  
Words like «исправлено» / PASS without evidence are rejected.

---

## DEVICE MODEL AFTER

| Concept | Rule |
|---------|------|
| `DeviceInstallation` | Installation identity. `revokedAt` = **global security block only**. |
| `LicenseActivation` | License slot on installation. Soft-revocable. |
| HOLDER_DISCONNECT | Soft-revoke `LicenseActivation` only (`revokeReason=HOLDER_DISCONNECT`). |
| Same license key after disconnect | `LICENSE_RECOVERY_REQUIRED` (no silent slot). |
| Different valid license | Normal activation if capacity. |
| Full slots recovery | `DEVICE_REPLACEMENT_REQUIRED` + explicit device list (no silent eviction). |

### DeviceInstallation.revokedAt — call-site audit

| File | Function | Trigger | Sets `DeviceInstallation.revokedAt`? |
|------|----------|---------|--------------------------------------|
| `src/devices/revoke-device-installation.ts` | `revokeDeviceInstallation` | Helper for **explicit global block** | YES (helper body) |
| *any current app path* | — | — | **NONE call the helper** |
| `src/devices/devices.service.ts` | `revoke` (`POST /devices/revoke`) | Mobile “self” remove | **NO** — soft-revokes activations + refresh tokens only |
| `src/licenses/telegram-license-link.service.ts` | `revokeDeviceAsHolder` | Telegram holder disconnect | **NO** — activation soft-revoke only |
| `src/licenses/device-replacement.service.ts` | replace flow | Explicit replacement | **NO** — old activation soft-revoke |
| `src/admin/licenses/admin-licenses.service.ts` | admin device disconnect | Admin | **NO** — activation soft-revoke |

**Definition of former “self”:** mobile `POST /api/v1/devices/revoke`. Under the new model it clears license slots on that installation and invalidates refresh tokens; it does **not** globally blacklist the installation.

---

## ADMIN TELEGRAM AUTHORITY

```
sender.id
 → AdminTelegramRevokedId? → DENY
 → Telegram-admin management initialized?
      (any AdminTelegramIdentity row OR any AdminTelegramRevokedId)
      YES → only ACTIVE+verified DB binding; env NEVER used
      NO  → bootstrap-only: ADMIN_TELEGRAM_IDS env
```

**Critical:** disconnecting the last ACTIVE binding leaves the system **initialized** → env cannot resurrect the old admin.

Profile: Connect / Replace / Disconnect (password + confirm).

---

## ADMIN DATA LINEAGE

| UI label | Frontend | API | Backend | DB / producer | Fallback |
|----------|----------|-----|---------|---------------|----------|
| Overview user counts | Dashboard/Overview | `GET /admin/dashboard/summary` | `AdminDashboardService` | `User` aggregates | — |
| Active devices | Overview | same | same | `DeviceInstallation` where `revokedAt IS NULL` | — |
| Active licenses | Overview | same | same | `License` ACTIVE | — |
| Sales / orders | Sales page | `GET /admin/orders` | `AdminOrdersService` | `Order` + payment/receipt | — |
| License status / devices | Licenses | `GET /admin/licenses` | `AdminLicensesService` | `License` + active `LicenseActivation` | — |
| Device manufacturer/model | Devices | `GET /admin/devices` | `AdminDevicesService` | `DeviceInstallation.deviceManufacturer/Model` ← Android register/telemetry | empty → installationId |
| Device app version | Devices | same | same | `appVersionName`/`appVersionCode` via `formatAppVersionLabel` | **UNKNOWN** (never invent `1.0.0`) |
| Device locale | Devices | same | same | `appLocale` | omit |
| Device lastSeen | Devices | same | same | `lastSeenAt` | dash |
| Analytics active devices | Analytics | `GET /admin/analytics` | `AdminAnalyticsService` | `DeviceInstallation` lastSeen window | — |
| Published APK version | Updates | `GET /admin/releases` | `AdminReleasesService` | `AppRelease` PUBLISHED | — |
| Min / latest policy | System / public config | `/admin/app-config`, `/api/v1/app-config` | `AppConfigService` | `AppVersion` | **null** if unset (not `1.0.0`) |
| Tariff prices | Tariffs | `/admin/plans` | `AdminPlansService` | `PlanPrice` | — |
| Telegram Admin status | Profile | `/admin/telegram/status` | `AdminTelegramService` | `AdminTelegramIdentity` | «Не подключён» |

**Version truth (independent):**
- A. PUBLISHED = `AppRelease.status=PUBLISHED`
- B. INSTALLED = `DeviceInstallation.appVersionName/Code`
- C. MINIMUM = `AppVersion.minimumSupportedVersion`

### `"1.0.0"` occurrence classification

| Location | Class |
|----------|-------|
| `prisma/seed.ts` | seed defaults only |
| `src/app-config/dto` Swagger examples | docs example |
| `src/bootstrap.ts` / health swagger `.setVersion('1.0.0')` | API package version string, not device telemetry |
| `src/**/*.spec.ts` fixtures | test-only |
| `docs/*` contract samples | docs |
| Public/admin config runtime fallback | **REMOVED** — returns `null` |
| Admin Devices UI | shows **UNKNOWN** when missing |

---

## CHECKLIST (code/test only — runtime separate)

| Check | Status |
|-------|--------|
| Holder disconnect soft-revokes activation | CODE + TEST |
| License B on same install | CODE + TEST name: `activates License B on same installation after holder disconnect of License A` |
| Same A key → recovery | CODE + TEST |
| Full slots → `DEVICE_REPLACEMENT_REQUIRED` | CODE + TEST |
| Env cannot resurrect after zero ACTIVE | CODE + TEST |
| Mobile self revoke does not set global `revokedAt` | CODE |
| RU/TJ mixed-script detector | TEST |
| Real Huawei / Admin Telegram E2E | **BLOCKED** until owner runs controlled production scenarios |

---

## TESTS / BUILD

Run and report exact counts in the release-gate final report.
