import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { del, get, head, issueSignedToken, put, presignUrl } from '@vercel/blob';
import { Readable } from 'stream';
import type {
  ReleaseDownloadAuthorization,
  ReleaseObjectHead,
  ReleaseStorageService,
  ReleaseUploadAuthorization,
} from './release-storage.types';

const MAX_APK_BYTES = 250 * 1024 * 1024;
const DEFAULT_UPLOAD_TTL_SEC = 15 * 60;
const DEFAULT_DOWNLOAD_TTL_SEC = 5 * 60;

@Injectable()
export class VercelBlobReleaseStorageService implements ReleaseStorageService {
  private readonly apkPrefix: string;
  private readonly token: string | undefined;

  constructor(private readonly configService: ConfigService) {
    this.apkPrefix = this.configService.get<string>('storage.apkPrefix', 'releases/android');
    this.token =
      this.configService.get<string>('storage.blobReadWriteToken') ||
      process.env.BLOB_READ_WRITE_TOKEN ||
      undefined;
  }

  providerName(): 'vercel_blob' {
    return 'vercel_blob';
  }

  /**
   * Configured when a RW token exists, or a connected Blob store is available via OIDC
   * (`BLOB_STORE_ID` + Vercel runtime / OIDC token).
   * Do not invent static BLOB_READ_WRITE_TOKEN when OIDC works.
   */
  isConfigured(): boolean {
    const provider = (process.env.RELEASE_STORAGE_PROVIDER ?? '').trim().toLowerCase();
    if (provider === 's3') {
      return false;
    }
    if (this.token) {
      return true;
    }
    if (this.hasOidcStoreBinding()) {
      return provider === '' || provider === 'auto' || provider === 'vercel_blob';
    }
    // Explicit provider on Vercel without store id yet (pre-connect / mid-redeploy)
    return provider === 'vercel_blob' && process.env.VERCEL === '1';
  }

  /** Safe diagnostics — never returns tokens or OIDC material. */
  getAuthDiagnostics(): {
    storeIdAvailable: boolean;
    authMode: 'oidc' | 'static_token' | 'none';
    configured: boolean;
  } {
    const storeIdAvailable = Boolean((process.env.BLOB_STORE_ID ?? '').trim());
    if (this.token) {
      return { storeIdAvailable, authMode: 'static_token', configured: this.isConfigured() };
    }
    if (this.hasOidcStoreBinding() || (storeIdAvailable && process.env.VERCEL === '1')) {
      return { storeIdAvailable, authMode: 'oidc', configured: this.isConfigured() };
    }
    return { storeIdAvailable, authMode: 'none', configured: this.isConfigured() };
  }

  private hasOidcStoreBinding(): boolean {
    const storeId = (process.env.BLOB_STORE_ID ?? '').trim();
    if (!storeId) {
      return false;
    }
    // On Vercel Functions OIDC is injected; locally after `vercel env pull` OIDC may refresh via CLI.
    return process.env.VERCEL === '1' || Boolean((process.env.VERCEL_OIDC_TOKEN ?? '').trim());
  }

  isSigningPolicyConfigured(): boolean {
    return Boolean(this.configService.get<string>('storage.allowedSigningCertSha256'));
  }

  buildApkObjectKey(releaseId: string): string {
    return `${this.apkPrefix}/${releaseId}/Ruznamo.apk`;
  }

  async createUploadAuthorization(
    pathname: string,
    opts?: { maximumSizeInBytes?: number; expiresInSeconds?: number; contentType?: string },
  ): Promise<ReleaseUploadAuthorization> {
    this.assertConfigured();
    const expiresInSeconds = opts?.expiresInSeconds ?? DEFAULT_UPLOAD_TTL_SEC;
    const validUntil = Date.now() + expiresInSeconds * 1000;
    const contentType = opts?.contentType ?? 'application/vnd.android.package-archive';

    const maximumSizeInBytes = opts?.maximumSizeInBytes ?? MAX_APK_BYTES;
    const allowedContentTypes = [
      contentType,
      'application/octet-stream',
      'application/zip',
    ];

    const signed = await issueSignedToken({
      pathname,
      operations: ['put'],
      validUntil,
      allowedContentTypes,
      maximumSizeInBytes,
      ...(this.token ? { token: this.token } : {}),
    });

    const { presignedUrl } = await presignUrl(signed, {
      access: 'private',
      pathname,
      operation: 'put',
      validUntil,
      allowedContentTypes,
      maximumSizeInBytes,
      allowOverwrite: true,
      addRandomSuffix: false,
    });

    return {
      pathname,
      uploadUrl: presignedUrl,
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
      },
      expiresAt: new Date(validUntil).toISOString(),
      provider: 'vercel_blob',
    };
  }

  async createDownloadAuthorization(
    pathname: string,
    opts?: { expiresInSeconds?: number },
  ): Promise<ReleaseDownloadAuthorization> {
    this.assertConfigured();
    const expiresInSeconds = opts?.expiresInSeconds ?? DEFAULT_DOWNLOAD_TTL_SEC;
    const validUntil = Date.now() + expiresInSeconds * 1000;

    const signed = await issueSignedToken({
      pathname,
      operations: ['get'],
      validUntil,
      ...(this.token ? { token: this.token } : {}),
    });

    const { presignedUrl } = await presignUrl(signed, {
      access: 'private',
      pathname,
      operation: 'get',
      validUntil,
      useCache: false,
    });

    return {
      pathname,
      downloadUrl: presignedUrl,
      expiresAt: new Date(validUntil).toISOString(),
      provider: 'vercel_blob',
    };
  }

  async head(pathname: string): Promise<ReleaseObjectHead> {
    this.assertConfigured();
    try {
      const details = await head(pathname, this.token ? { token: this.token } : undefined);
      return { exists: true, size: Number(details.size ?? 0), url: details.url };
    } catch {
      return { exists: false, size: 0 };
    }
  }

  async getBuffer(pathname: string): Promise<Buffer> {
    this.assertConfigured();
    const result = await get(pathname, {
      access: 'private',
      useCache: false,
      ...(this.token ? { token: this.token } : {}),
    });
    if (!result?.stream) {
      throw new ServiceUnavailableException({
        code: 'BLOB_OBJECT_NOT_FOUND',
        message: 'APK object not found in Blob storage',
      });
    }
    const chunks: Buffer[] = [];
    const reader = result.stream.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      if (value) {
        chunks.push(Buffer.from(value));
      }
    }
    return Buffer.concat(chunks);
  }

  async getStream(pathname: string): Promise<Readable> {
    const buffer = await this.getBuffer(pathname);
    return Readable.from(buffer);
  }

  async delete(pathname: string): Promise<void> {
    this.assertConfigured();
    await del(pathname, this.token ? { token: this.token } : undefined);
  }

  /** Server-side put — tests / orphan repair only; production Admin uses direct PUT. */
  async putObject(pathname: string, body: Buffer, contentType: string): Promise<void> {
    this.assertConfigured();
    await put(pathname, body, {
      access: 'private',
      contentType,
      addRandomSuffix: false,
      allowOverwrite: true,
      ...(this.token ? { token: this.token } : {}),
    });
  }

  private assertConfigured(): void {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException({
        code: 'OBJECT_STORAGE_NOT_CONFIGURED',
        message: 'Vercel Private Blob is not configured',
      });
    }
  }
}
