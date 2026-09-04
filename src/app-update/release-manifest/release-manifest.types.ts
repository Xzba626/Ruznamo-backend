/** Domain-separated signed release identity for Android self-update. */
export const RELEASE_MANIFEST_DOMAIN = 'RUZNAMO_ANDROID_RELEASE_MANIFEST_V1';

export const RELEASE_MANIFEST_VERSION = 1 as const;

export const RELEASE_MANIFEST_SIGNATURE_ALGORITHM = 'Ed25519' as const;

/**
 * Authoritative fields included in the signed canonical payload.
 * Field order for JSON serialization is fixed by {@link CANONICAL_MANIFEST_KEYS}.
 */
export type ReleaseManifestPayload = {
  manifestVersion: typeof RELEASE_MANIFEST_VERSION;
  releaseId: string;
  packageName: string;
  versionName: string;
  versionCode: number;
  fileSize: number;
  sha256: string;
  mandatory: boolean;
  publishedAt: string;
  changelogRu: string;
  changelogTg: string;
};

/** Fixed key order — never rely on JS object enumeration order alone. */
export const CANONICAL_MANIFEST_KEYS: readonly (keyof ReleaseManifestPayload)[] = [
  'manifestVersion',
  'releaseId',
  'packageName',
  'versionName',
  'versionCode',
  'fileSize',
  'sha256',
  'mandatory',
  'publishedAt',
  'changelogRu',
  'changelogTg',
] as const;

export type SignedReleaseManifest = {
  manifest: ReleaseManifestPayload;
  /** UTF-8 string that was signed: domain + LF + canonical JSON. */
  signedPayload: string;
  /** Base64url (no padding) Ed25519 signature over UTF-8(signedPayload). */
  signature: string;
  signatureAlgorithm: typeof RELEASE_MANIFEST_SIGNATURE_ALGORITHM;
  keyId: string;
};
