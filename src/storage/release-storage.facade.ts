import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Readable } from 'stream';
import { ObjectStorageService } from './object-storage.service';
import type {
  ReleaseDownloadAuthorization,
  ReleaseObjectHead,
  ReleaseStorageProviderName,
  ReleaseStorageService,
  ReleaseUploadAuthorization,
} from './release-storage.types';
import { VercelBlobReleaseStorageService } from './vercel-blob-release-storage.service';

/**
 * Production authority: Vercel Private Blob when configured.
 * Legacy S3 remains available for local/dev if fully configured and Blob is not.
 */
@Injectable()
export class ReleaseStorageFacade implements ReleaseStorageService {
  constructor(
    private readonly configService: ConfigService,
    private readonly vercelBlob: VercelBlobReleaseStorageService,
    private readonly s3: ObjectStorageService,
  ) {}

  private active(): ReleaseStorageService | null {
    if (this.vercelBlob.isConfigured()) {
      return this.vercelBlob;
    }
    if (this.s3.isConfigured()) {
      return this.s3AsReleaseStorage();
    }
    return null;
  }

  providerName(): ReleaseStorageProviderName {
    return this.active()?.providerName() ?? 'none';
  }

  isConfigured(): boolean {
    return Boolean(this.active()?.isConfigured());
  }

  isSigningPolicyConfigured(): boolean {
    return Boolean(this.configService.get<string>('storage.allowedSigningCertSha256'));
  }

  /** Safe storage diagnostics for Admin overview (no secrets). */
  getStorageDiagnostics(): {
    storeIdAvailable: boolean;
    authMode: 'oidc' | 'static_token' | 'none' | 's3';
    configured: boolean;
    provider: ReleaseStorageProviderName;
  } {
    if (this.vercelBlob.isConfigured()) {
      const d = this.vercelBlob.getAuthDiagnostics();
      return {
        storeIdAvailable: d.storeIdAvailable,
        authMode: d.authMode,
        configured: true,
        provider: 'vercel_blob',
      };
    }
    if (this.s3.isConfigured()) {
      return {
        storeIdAvailable: false,
        authMode: 's3',
        configured: true,
        provider: 's3',
      };
    }
    const d = this.vercelBlob.getAuthDiagnostics();
    return {
      storeIdAvailable: d.storeIdAvailable,
      authMode: d.authMode,
      configured: false,
      provider: 'none',
    };
  }

  buildApkObjectKey(releaseId: string): string {
    const active = this.active();
    if (!active) {
      return `releases/android/${releaseId}/Ruznamo.apk`;
    }
    return active.buildApkObjectKey(releaseId);
  }

  createUploadAuthorization(
    pathname: string,
    opts?: { maximumSizeInBytes?: number; expiresInSeconds?: number; contentType?: string },
  ): Promise<ReleaseUploadAuthorization> {
    return this.require().createUploadAuthorization(pathname, opts);
  }

  createDownloadAuthorization(
    pathname: string,
    opts?: { expiresInSeconds?: number },
  ): Promise<ReleaseDownloadAuthorization> {
    return this.require().createDownloadAuthorization(pathname, opts);
  }

  head(pathname: string): Promise<ReleaseObjectHead> {
    return this.require().head(pathname);
  }

  getBuffer(pathname: string): Promise<Buffer> {
    return this.require().getBuffer(pathname);
  }

  getStream(pathname: string): Promise<Readable> {
    return this.require().getStream(pathname);
  }

  delete(pathname: string): Promise<void> {
    return this.require().delete(pathname);
  }

  putObject(pathname: string, body: Buffer, contentType: string): Promise<void> {
    const active = this.require();
    if (!active.putObject) {
      throw new ServiceUnavailableException({
        code: 'PUT_NOT_SUPPORTED',
        message: 'Direct server put is not available for this storage provider',
      });
    }
    return active.putObject(pathname, body, contentType);
  }

  private require(): ReleaseStorageService {
    const active = this.active();
    if (!active) {
      throw new ServiceUnavailableException({
        code: 'OBJECT_STORAGE_NOT_CONFIGURED',
        message: 'Object storage is not configured',
      });
    }
    return active;
  }

  /** Adapt legacy S3 service to ReleaseStorageService (local/dev fallback). */
  private s3AsReleaseStorage(): ReleaseStorageService {
    const s3 = this.s3;
    return {
      providerName: () => 's3' as const,
      isConfigured: () => s3.isConfigured(),
      isSigningPolicyConfigured: () => s3.isSigningPolicyConfigured(),
      buildApkObjectKey: (releaseId: string) =>
        `${this.configService.get<string>('storage.apkPrefix', 'releases/android')}/${releaseId}/Ruznamo.apk`,
      createUploadAuthorization: async () => {
        throw new ServiceUnavailableException({
          code: 'S3_DIRECT_UPLOAD_UNSUPPORTED',
          message: 'Direct browser upload requires Vercel Private Blob. Configure RELEASE_STORAGE_PROVIDER=vercel_blob.',
        });
      },
      createDownloadAuthorization: async (pathname, opts) => {
        const expiresInSeconds = opts?.expiresInSeconds ?? 300;
        const url = await s3.getSignedDownloadUrl(pathname, expiresInSeconds);
        return {
          pathname,
          downloadUrl: url,
          expiresAt: new Date(Date.now() + expiresInSeconds * 1000).toISOString(),
          provider: 's3',
        };
      },
      head: (pathname) => s3.headObject(pathname),
      getBuffer: async (pathname) => {
        const stream = await s3.getObjectStream(pathname);
        const chunks: Buffer[] = [];
        for await (const chunk of stream) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        return Buffer.concat(chunks);
      },
      getStream: (pathname) => s3.getObjectStream(pathname),
      delete: (pathname) => s3.deleteObject(pathname),
      putObject: (pathname, body, contentType) => s3.putObject(pathname, body, contentType),
    };
  }
}
