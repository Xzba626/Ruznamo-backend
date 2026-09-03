import { VercelBlobReleaseStorageService } from './vercel-blob-release-storage.service';

describe('VercelBlobReleaseStorageService', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('is not configured without provider or token', () => {
    delete process.env.RELEASE_STORAGE_PROVIDER;
    delete process.env.BLOB_READ_WRITE_TOKEN;
    delete process.env.VERCEL;
    const service = new VercelBlobReleaseStorageService({
      get: jest.fn().mockReturnValue(undefined),
    } as never);
    expect(service.isConfigured()).toBe(false);
    expect(service.providerName()).toBe('vercel_blob');
  });

  it('is configured when owner sets vercel_blob on Vercel', () => {
    process.env.RELEASE_STORAGE_PROVIDER = 'vercel_blob';
    process.env.VERCEL = '1';
    const service = new VercelBlobReleaseStorageService({
      get: jest.fn().mockReturnValue(undefined),
    } as never);
    expect(service.isConfigured()).toBe(true);
  });

  it('builds immutable unique pathnames', () => {
    const service = new VercelBlobReleaseStorageService({
      get: jest.fn((key: string, fallback?: string) =>
        key === 'storage.apkPrefix' ? 'releases/android' : fallback,
      ),
    } as never);
    expect(service.buildApkObjectKey('relA')).toBe('releases/android/relA/Ruznamo.apk');
    expect(service.buildApkObjectKey('relB')).not.toBe(service.buildApkObjectKey('relA'));
  });
});
