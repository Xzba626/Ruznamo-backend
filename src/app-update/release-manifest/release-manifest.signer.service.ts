import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { AppRelease } from '@prisma/client';
import type { KeyObject } from 'crypto';
import {
  buildManifestPayload,
  buildSignedPayload,
} from './release-manifest.canonical';
import {
  derivePublicKey,
  exportRawPublicKeyHex,
  fromBase64Url,
  parsePkcs8PrivateKey,
  signUtf8Payload,
  toBase64Url,
  verifyUtf8Payload,
} from './release-manifest.crypto';
import {
  RELEASE_MANIFEST_SIGNATURE_ALGORITHM,
  type SignedReleaseManifest,
} from './release-manifest.types';

type LoadedKey = { privateKey: KeyObject; publicKey: KeyObject; keyId: string };

@Injectable()
export class ReleaseManifestSignerService {
  private cached: LoadedKey | null | undefined;
  private loadError: string | null = null;

  isConfigured(): boolean {
    return this.loadQuiet() !== null;
  }

  getKeyId(): string | null {
    return this.loadQuiet()?.keyId ?? null;
  }

  /** Non-secret status for Admin overview. Never returns private material. */
  getStatus(): {
    configured: boolean;
    keyId: string | null;
    signatureAlgorithm: typeof RELEASE_MANIFEST_SIGNATURE_ALGORITHM;
  } {
    const loaded = this.loadQuiet();
    return {
      configured: loaded !== null,
      keyId: loaded?.keyId ?? null,
      signatureAlgorithm: RELEASE_MANIFEST_SIGNATURE_ALGORITHM,
    };
  }

  /**
   * Publish gate — proves env is present and the private key can sign.
   * Does not persist anything.
   */
  assertCanSign(): void {
    const rawKey = (process.env.ANDROID_RELEASE_MANIFEST_PRIVATE_KEY ?? '').trim();
    const keyId = (process.env.ANDROID_RELEASE_MANIFEST_KEY_ID ?? '').trim();
    if (!rawKey || !keyId) {
      throw new ServiceUnavailableException({
        code: 'MANIFEST_SIGNING_NOT_CONFIGURED',
        message: 'Release manifest signing key is not configured',
      });
    }

    const loaded = this.loadQuiet();
    if (!loaded) {
      throw new ServiceUnavailableException({
        code: 'MANIFEST_SIGNING_FAILED',
        message: this.loadError
          ? `Manifest signing failed: ${this.loadError}`
          : 'Manifest signing key is invalid',
      });
    }

    try {
      const probe = buildManifestPayload({
        releaseId: 'probe',
        packageName: 'com.Tajroot.Ruznamo',
        versionName: '0.0.0',
        versionCode: 0,
        fileSize: 0,
        sha256: '0'.repeat(64),
        mandatory: false,
        publishedAt: new Date(0),
        changelogRu: '',
        changelogTg: '',
      });
      const payload = buildSignedPayload(probe);
      const signature = signUtf8Payload(loaded.privateKey, payload);
      if (!verifyUtf8Payload(loaded.publicKey, payload, signature)) {
        throw new Error('self-verify failed');
      }
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      throw new ServiceUnavailableException({
        code: 'MANIFEST_SIGNING_FAILED',
        message:
          error instanceof Error
            ? `Manifest signing failed: ${error.message}`
            : 'Manifest signing failed',
      });
    }
  }

  signRelease(
    release: Pick<
      AppRelease,
      | 'id'
      | 'packageName'
      | 'versionName'
      | 'versionCode'
      | 'fileSize'
      | 'sha256'
      | 'mandatory'
      | 'publishedAt'
      | 'changelogRu'
      | 'changelogTg'
    >,
  ): SignedReleaseManifest {
    const loaded = this.requireLoaded();
    if (!release.publishedAt) {
      throw new ServiceUnavailableException({
        code: 'MANIFEST_SIGNING_FAILED',
        message: 'Cannot sign release without publishedAt',
      });
    }

    try {
      const manifest = buildManifestPayload({
        releaseId: release.id,
        packageName: release.packageName,
        versionName: release.versionName,
        versionCode: release.versionCode,
        fileSize: release.fileSize,
        sha256: release.sha256,
        mandatory: release.mandatory,
        publishedAt: release.publishedAt,
        changelogRu: release.changelogRu,
        changelogTg: release.changelogTg,
      });
      const signedPayload = buildSignedPayload(manifest);
      const signatureBuf = signUtf8Payload(loaded.privateKey, signedPayload);
      return {
        manifest,
        signedPayload,
        signature: toBase64Url(signatureBuf),
        signatureAlgorithm: RELEASE_MANIFEST_SIGNATURE_ALGORITHM,
        keyId: loaded.keyId,
      };
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      throw new ServiceUnavailableException({
        code: 'MANIFEST_SIGNING_FAILED',
        message:
          error instanceof Error
            ? `Manifest signing failed: ${error.message}`
            : 'Manifest signing failed',
      });
    }
  }

  verifySignedManifest(signed: SignedReleaseManifest, publicKey?: KeyObject): boolean {
    const key = publicKey ?? this.loadQuiet()?.publicKey;
    if (!key) return false;
    try {
      return verifyUtf8Payload(key, signed.signedPayload, fromBase64Url(signed.signature));
    } catch {
      return false;
    }
  }

  private requireLoaded(): LoadedKey {
    const rawKey = (process.env.ANDROID_RELEASE_MANIFEST_PRIVATE_KEY ?? '').trim();
    const keyId = (process.env.ANDROID_RELEASE_MANIFEST_KEY_ID ?? '').trim();
    if (!rawKey || !keyId) {
      throw new ServiceUnavailableException({
        code: 'MANIFEST_SIGNING_NOT_CONFIGURED',
        message: 'Release manifest signing key is not configured',
      });
    }
    const loaded = this.loadQuiet();
    if (!loaded) {
      throw new ServiceUnavailableException({
        code: 'MANIFEST_SIGNING_FAILED',
        message: this.loadError
          ? `Manifest signing failed: ${this.loadError}`
          : 'Manifest signing key is invalid',
      });
    }
    return loaded;
  }

  private loadQuiet(): LoadedKey | null {
    if (this.cached !== undefined) {
      return this.cached;
    }

    const rawKey = (process.env.ANDROID_RELEASE_MANIFEST_PRIVATE_KEY ?? '').trim();
    const keyId = (process.env.ANDROID_RELEASE_MANIFEST_KEY_ID ?? '').trim();
    if (!rawKey || !keyId) {
      this.cached = null;
      this.loadError = null;
      return null;
    }

    try {
      const privateKey = parsePkcs8PrivateKey(rawKey);
      const publicKey = derivePublicKey(privateKey);
      exportRawPublicKeyHex(publicKey);
      this.cached = { privateKey, publicKey, keyId };
      this.loadError = null;
      return this.cached;
    } catch (error) {
      this.cached = null;
      this.loadError = error instanceof Error ? error.message : 'invalid key';
      return null;
    }
  }

  /** @internal test hook */
  resetCacheForTests(): void {
    this.cached = undefined;
    this.loadError = null;
  }
}
