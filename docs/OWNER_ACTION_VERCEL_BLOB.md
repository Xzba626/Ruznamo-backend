# OWNER ACTION REQUIRED — Vercel Private Blob

Do **not** create storage on the Admin Panel project.  
Do **not** choose Public.  
Do **not** paste tokens into chat.

## Exact target

| Item | Value |
|------|--------|
| Product | Ruznamo APK store |
| Vercel team/account | the one that owns production backend |
| Backend project | **ruznamo-backend-o4xk** |
| Store name | **ruznamo-releases** |
| Access | **Private** |
| Connect to | **only** `ruznamo-backend-o4xk` |

## Clicks

1. Open [Vercel Dashboard](https://vercel.com/dashboard)
2. Open project **`ruznamo-backend-o4xk`** (this is the Nest API, not `admin-panel-ten-tau-90`)
3. **Storage** → **Create** → **Blob**
4. Name: `ruznamo-releases`
5. Access: **Private**
6. Confirm the store is connected to **`ruznamo-backend-o4xk`**
7. Redeploy the backend after the store is connected (Vercel injects Blob env/OIDC)
8. Optional backend env (no secrets): `RELEASE_STORAGE_PROVIDER=vercel_blob`

Do not add `BLOB_READ_WRITE_TOKEN` to the Admin Panel project.

## What Cursor will do after you confirm

- Prove real PUT / HEAD / GET / DELETE with a tiny test object, then delete it
- Enable Admin **Загрузить** (still no Function APK proxy)
- Keep **Publish** blocked until production signer SHA is configured (checkpoint 2)

## Checkpoint 2 (later, not now)

Create `ruznamo-production.jks` **outside Git** (e.g. `D:\Ruznamo-Secrets\`).  
Backend gets **certificate SHA-256 only**. Never send the `.jks` or password.
