# OWNER ACTION REQUIRED — Release Manifest Signing Key (Ed25519)

**Do not paste the private key into chat, Git, Admin frontend, or Android.**

This key is **separate** from `ruznamo-production.jks` (APK signing).

---

## Why Ed25519

- Native in Node.js `crypto` (backend) and well-supported on Android.
- Fixed-size keys/signatures, no ASN.1 ambiguity for the signature bytes we ship.
- Distinct from Android APK signing identity (intentional separation).

---

## 1. Generate keypair on your machine (owner only)

From the backend repo root:

```bash
npx ts-node -P tsconfig.scripts.json scripts/generate-release-manifest-keypair.ts
```

The script prints:

| Output | Who keeps it |
|--------|----------------|
| `ANDROID_RELEASE_MANIFEST_KEY_ID` | Backend env + Android embeds by keyId |
| `ANDROID_RELEASE_MANIFEST_PRIVATE_KEY` (PKCS8 PEM) | **Backend Vercel only** (secret) |
| Public key raw hex (32 bytes) | **Android** embed only |
| Public key SPKI PEM | Optional backup / docs |

---

## 2. Store private key (owner)

Recommended:

1. Password manager / offline sealed backup of the PKCS8 PEM.
2. Vercel → project **ruznamo-backend-o4xk** → Settings → Environment Variables → Production (+ Preview if needed):
   - `ANDROID_RELEASE_MANIFEST_PRIVATE_KEY` = full PEM including `BEGIN/END` lines (or single-line base64 PKCS8 DER).
   - `ANDROID_RELEASE_MANIFEST_KEY_ID` = e.g. `rmk_v1`
3. Redeploy backend after saving env vars.

Never commit the private key. Never put it in Admin Panel env.

---

## 3. Give Android only the public key

Hand to Android Cursor (safe to share):

```text
keyId: rmk_v1
algorithm: Ed25519
publicKeyRawHex: <64 hex chars>
```

Android embeds this public key and verifies `signedManifest` from `GET /api/v1/app/update`.

---

## 4. Backup

Keep an offline copy of:

- private PEM
- keyId
- public raw hex

Rotation later: introduce `rmk_v2`, deploy backend with new private key, ship Android with both public keys temporarily, then retire v1.

---

## 5. Expected Admin gate before key exists

After this code deploys **without** the env vars:

- **Manifest-подпись: не настроена**
- **Publish: BLOCKED**

That is the intended REAL PASS negative gate.

---

## 6. Do not publish existing DRAFT

Current controlled DRAFT `1.0.13 (14)` stays DRAFT. Setting the manifest key does **not** auto-publish anything.
