# APK Release Storage — Gap Report (Vercel Private Blob)

**Date:** 2026-09-03  
**Authority:** Vercel Private Blob (owner decision). No Cloudflare / external S3 for production.

## ALREADY CORRECT

- Prisma `AppRelease` + statuses DRAFT / PUBLISHED / ARCHIVED / PURGED
- Admin overview, draft metadata, publish (archives previous), archive, purge-file APIs
- JS APK inspector (`app-info-parser` + `adm-zip`) — no aapt required on Vercel
- Package gate `com.Tajroot.Ruznamo`, optional signer SHA on inspect
- versionCode monotonicity vs published
- Publish blocked when signing policy unset
- Admin Updates UI skeleton (storageConfigured / signingConfigured)
- Public `GET /api/v1/app/update` (needs adaptation: remove long-lived downloadUrl)

## NEEDS ADAPTATION

- **Upload path:** today browser → Nest multipart memory → S3. Violates Vercel ~4.5MB Function payload. Must become browser → Blob direct PUT.
- **Storage authority:** replace production S3 config with Vercel Private Blob adapter; keep S3 isolated for local/dev if needed.
- **Update check:** return metadata + `releaseId` only; no signed URL on check.
- **Download:** dedicated endpoint issues fresh short-lived signed GET.
- **Publish recheck:** verify stored package + signer vs env again.
- **Admin UI:** upload state machine + real progress + finalize/validate phases.

## MISSING (before this change)

- `@vercel/blob` adapter / ReleaseStorage abstraction
- Direct upload authorization (presigned PUT)
- Finalize-from-Blob validation
- Public download-authorization endpoint for Android
- Android updater (separate repo `D:\Ruznamo`) — out of this backend pass after Blob works

## BLOCKED BY OWNER ACTION

1. Create **Private** Vercel Blob store on the **backend** Vercel project (not Admin panel project).
2. Create permanent production Android keystore (outside Git); provide cert SHA-256 only to backend env.
3. First production Publish only after explicit owner authorization.

See: `docs/OWNER_ACTION_VERCEL_BLOB.md`
