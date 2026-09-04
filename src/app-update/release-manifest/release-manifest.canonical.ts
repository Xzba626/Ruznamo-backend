import {
  CANONICAL_MANIFEST_KEYS,
  RELEASE_MANIFEST_DOMAIN,
  RELEASE_MANIFEST_VERSION,
  type ReleaseManifestPayload,
} from './release-manifest.types';

function jsonEscape(value: string): string {
  return JSON.stringify(value);
}

/**
 * Deterministic compact JSON with fixed key order.
 * Does not use JSON.stringify on an arbitrary object (enumeration order is not the contract).
 */
export function serializeCanonicalManifestJson(manifest: ReleaseManifestPayload): string {
  if (manifest.manifestVersion !== RELEASE_MANIFEST_VERSION) {
    throw new Error(`Unsupported manifestVersion: ${manifest.manifestVersion}`);
  }

  const parts: string[] = [];
  for (const key of CANONICAL_MANIFEST_KEYS) {
    const value = manifest[key];
    let encoded: string;
    if (typeof value === 'string') {
      encoded = jsonEscape(value);
    } else if (typeof value === 'number') {
      if (!Number.isInteger(value)) {
        throw new Error(`Manifest field ${key} must be an integer`);
      }
      encoded = String(value);
    } else if (typeof value === 'boolean') {
      encoded = value ? 'true' : 'false';
    } else {
      throw new Error(`Unsupported manifest field type for ${key}`);
    }
    parts.push(`${jsonEscape(key)}:${encoded}`);
  }
  return `{${parts.join(',')}}`;
}

/** Bytes that Ed25519 signs: domain separator + LF + canonical JSON (UTF-8). */
export function buildSignedPayload(manifest: ReleaseManifestPayload): string {
  return `${RELEASE_MANIFEST_DOMAIN}\n${serializeCanonicalManifestJson(manifest)}`;
}

export function buildManifestPayload(input: {
  releaseId: string;
  packageName: string;
  versionName: string;
  versionCode: number;
  fileSize: number | bigint;
  sha256: string;
  mandatory: boolean;
  publishedAt: Date | string;
  changelogRu?: string | null;
  changelogTg?: string | null;
}): ReleaseManifestPayload {
  const publishedAt =
    typeof input.publishedAt === 'string'
      ? input.publishedAt
      : input.publishedAt.toISOString();

  return {
    manifestVersion: RELEASE_MANIFEST_VERSION,
    releaseId: input.releaseId,
    packageName: input.packageName,
    versionName: input.versionName,
    versionCode: input.versionCode,
    fileSize: typeof input.fileSize === 'bigint' ? Number(input.fileSize) : input.fileSize,
    sha256: input.sha256.toLowerCase(),
    mandatory: Boolean(input.mandatory),
    publishedAt,
    changelogRu: input.changelogRu ?? '',
    changelogTg: input.changelogTg ?? '',
  };
}
