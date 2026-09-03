# OWNER ACTION — Vercel Private Blob

## Store (owner confirmed)

| Item | Value |
|------|--------|
| Store | **ruznamo-releases** |
| Access | **Private** |
| Project | **ruznamo-backend-o4xk** only |
| Region | IAD1 |

Optional non-secret backend env: `RELEASE_STORAGE_PROVIDER=vercel_blob`  
OIDC uses `BLOB_STORE_ID` + short-lived `VERCEL_OIDC_TOKEN` (auto). Do **not** invent static `BLOB_READ_WRITE_TOKEN` when OIDC works.

After connecting the store, backend must be **redeployed** so runtime sees store binding.

## Checkpoint API (Admin JWT required)

`POST /api/v1/admin/releases/storage-smoke` — PUT/HEAD/GET/DELETE on `healthchecks/releases/<uuid>.txt`, then proves gone.

## Checkpoint 2 (later — not this block)

Create `ruznamo-production.jks` outside Git. Backend gets **certificate SHA-256 only**. Never paste `.jks` or passwords into chat.
