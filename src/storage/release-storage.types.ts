import { Readable } from 'stream';

export type ReleaseStorageProviderName = 'vercel_blob' | 's3' | 'none';

export interface ReleaseObjectHead {
  exists: boolean;
  size: number;
  url?: string;
}

export interface ReleaseUploadAuthorization {
  pathname: string;
  uploadUrl: string;
  method: 'PUT';
  headers: Record<string, string>;
  expiresAt: string;
  provider: ReleaseStorageProviderName;
}

export interface ReleaseDownloadAuthorization {
  pathname: string;
  downloadUrl: string;
  expiresAt: string;
  provider: ReleaseStorageProviderName;
}

export interface ReleaseStorageService {
  providerName(): ReleaseStorageProviderName;
  isConfigured(): boolean;
  isSigningPolicyConfigured(): boolean;
  buildApkObjectKey(releaseId: string): string;
  createUploadAuthorization(pathname: string, opts?: {
    maximumSizeInBytes?: number;
    expiresInSeconds?: number;
    contentType?: string;
  }): Promise<ReleaseUploadAuthorization>;
  createDownloadAuthorization(pathname: string, opts?: {
    expiresInSeconds?: number;
  }): Promise<ReleaseDownloadAuthorization>;
  head(pathname: string): Promise<ReleaseObjectHead>;
  getBuffer(pathname: string): Promise<Buffer>;
  getStream(pathname: string): Promise<Readable>;
  delete(pathname: string): Promise<void>;
  putObject?(pathname: string, body: Buffer, contentType: string): Promise<void>;
}
