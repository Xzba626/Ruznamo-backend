import { registerAs } from '@nestjs/config';

export const storageConfig = registerAs('storage', () => ({
  // Legacy S3-compatible (local/dev only; production authority is Vercel Private Blob)
  endpoint: (process.env.S3_ENDPOINT ?? '').trim() || undefined,
  region: (process.env.S3_REGION ?? 'auto').trim(),
  bucket: (process.env.S3_BUCKET ?? '').trim() || undefined,
  accessKeyId: (process.env.S3_ACCESS_KEY_ID ?? '').trim() || undefined,
  secretAccessKey: (process.env.S3_SECRET_ACCESS_KEY ?? '').trim() || undefined,
  publicBaseUrl: (process.env.S3_PUBLIC_BASE_URL ?? '').trim() || undefined,
  apkPrefix: (process.env.S3_APK_PREFIX ?? process.env.BLOB_APK_PREFIX ?? 'releases/android').trim(),
  // Vercel Blob
  blobReadWriteToken: (process.env.BLOB_READ_WRITE_TOKEN ?? '').trim() || undefined,
  releaseStorageProvider: (process.env.RELEASE_STORAGE_PROVIDER ?? 'auto').trim().toLowerCase(),
  expectedPackageName: (
    process.env.ANDROID_PACKAGE_NAME ?? 'com.Tajroot.Ruznamo'
  ).trim(),
  allowedSigningCertSha256: (
    process.env.ANDROID_RELEASE_SIGNING_CERT_SHA256 ?? ''
  )
    .trim()
    .toLowerCase() || undefined,
}));
