# Android self-update (v1) — backend contract

Android implementation lives in `D:\Ruznamo` (separate repo). Backend contract is already:

- `GET /api/v1/app/update?versionCode=&locale=` → metadata only, **no** download URL
- `POST /api/v1/app/releases/:releaseId/download` → fresh 5-minute signed GET URL
- Entitlement is **not** required for update check/download
- Latest published authority: `AppRelease` status=PUBLISHED
- Mandatory flag: `AppRelease.mandatory` (do not enable for first production E2E)
- Minimum supported: existing `AppVersion.minimumSupportedVersion` (legacy, labeled separately)

Android still to implement after Blob + production signer:

- 12h last-check guard + WorkManager + manual check
- silent auto no-update / silent auto offline
- download progress, verify SHA/package/version/signer, Package Installer
- preserve Room / DataStore / installationId

Do not start Android work until OWNER Blob + production keystore checkpoints pass.
