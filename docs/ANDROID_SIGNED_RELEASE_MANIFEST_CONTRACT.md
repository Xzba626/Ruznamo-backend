# Android frozen contract — Signed Release Manifest v1

**Status:** Backend contract ready. Production private key is **owner-generated** (not in repo).

**Algorithm:** Ed25519 (Node `crypto.sign(null, …)` / Android Ed25519 verify)

**Why not APK jks:** Manifest signing identity is separate from `ruznamo-production.jks`.

---

## Domain separation

Signed UTF-8 string:

```text
RUZNAMO_ANDROID_RELEASE_MANIFEST_V1
<canonical-json>
```

Exactly one LF (`\n`) between domain and JSON. No trailing LF after JSON.

---

## Canonical JSON

- Compact JSON object (no spaces).
- **Fixed key order** (never `JSONObject` / random map order):

1. `manifestVersion` (number, must be `1`)
2. `releaseId` (string)
3. `packageName` (string)
4. `versionName` (string)
5. `versionCode` (integer)
6. `fileSize` (integer)
7. `sha256` (lowercase hex string)
8. `mandatory` (boolean `true`/`false`)
9. `publishedAt` (ISO-8601 string from server)
10. `changelogRu` (string, may be empty)
11. `changelogTg` (string, may be empty)

Unknown `manifestVersion` → **fail closed**.

---

## `GET /api/v1/app/update` when update available

```json
{
  "updateAvailable": true,
  "currentVersionCode": 14,
  "releaseId": "<cuid>",
  "latestVersionName": "1.0.15",
  "latestVersionCode": 16,
  "latest": {
    "releaseId": "<cuid>",
    "versionName": "1.0.15",
    "versionCode": 16,
    "mandatory": false,
    "fileSize": 26323888,
    "sha256": "<hex>",
    "packageName": "com.Tajroot.Ruznamo",
    "signingCertificateSha256": "<hex>",
    "changelog": "<locale>",
    "publishedAt": "2026-09-04T12:00:00.000Z"
  },
  "signedManifest": {
    "manifest": { "...canonical fields..." },
    "signature": "<base64url-no-padding>",
    "signatureAlgorithm": "Ed25519",
    "keyId": "rmk_v1",
    "signedPayload": "RUZNAMO_ANDROID_RELEASE_MANIFEST_V1\n{...}"
  }
}
```

When no update: `signedManifest: null`.

Never returns private key material.

---

## Signature encoding

- Sign UTF-8 bytes of `signedPayload`.
- Transmit signature as **base64url without padding**.
- Android may rebuild `signedPayload` from `manifest` using the algorithm above, or verify the provided `signedPayload` **only if** it equals the rebuilt canonical form (prefer rebuild).

---

## Public key Android format

- **Raw 32-byte Ed25519 public key**, lowercase **hex** (64 chars).
- Mapped by `keyId`.
- SPKI PEM is optional for tooling; runtime should use raw hex.

---

## Download binding

After manifest verify:

`POST /api/v1/app/releases/:releaseId/download`

- `releaseId` **must** be `signedManifest.manifest.releaseId`
- Response includes `releaseId`, `sha256`, `fileSize`, `packageName`, short-lived `downloadUrl`
- Then verify APK bytes SHA-256 / package / version / APK signer independently

---

## Negative cases (Android fail-closed)

| Case | Expected |
|------|----------|
| 1-byte manifest change | FAIL |
| sha256 changed | FAIL |
| versionCode changed | FAIL |
| wrong public key | FAIL |
| signature flipped | FAIL |
| unknown manifestVersion | FAIL |
| missing signedManifest on updateAvailable | FAIL |

---

## Backend env (owner)

See `docs/OWNER_ACTION_RELEASE_MANIFEST_KEY.md`.
