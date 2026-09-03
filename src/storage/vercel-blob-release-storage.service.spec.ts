import { VercelBlobReleaseStorageService } from './vercel-blob-release-storage.service';

describe('VercelBlobReleaseStorageService', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  function service() {
    return new VercelBlobReleaseStorageService({
      get: jest.fn().mockReturnValue(undefined),
    } as never);
  }

  it('is not configured without provider, store id, or token', () => {
    delete process.env.RELEASE_STORAGE_PROVIDER;
    delete process.env.BLOB_READ_WRITE_TOKEN;
    delete process.env.BLOB_STORE_ID;
    delete process.env.VERCEL;
    delete process.env.VERCEL_OIDC_TOKEN;
    expect(service().isConfigured()).toBe(false);
    expect(service().getAuthDiagnostics().authMode).toBe('none');
  });

  it('is configured when owner sets vercel_blob on Vercel', () => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    delete process.env.BLOB_STORE_ID;
    process.env.RELEASE_STORAGE_PROVIDER = 'vercel_blob';
    process.env.VERCEL = '1';
    expect(service().isConfigured()).toBe(true);
  });

  it('is configured via OIDC when BLOB_STORE_ID is present on Vercel', () => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    delete process.env.RELEASE_STORAGE_PROVIDER;
    process.env.BLOB_STORE_ID = 'store_test_ruznamo';
    process.env.VERCEL = '1';
    const svc = service();
    expect(svc.isConfigured()).toBe(true);
    expect(svc.getAuthDiagnostics()).toEqual({
      storeIdAvailable: true,
      authMode: 'oidc',
      configured: true,
    });
  });

  it('reports static_token auth mode without printing secrets', () => {
    process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_rw_test_token';
    delete process.env.BLOB_STORE_ID;
    const d = service().getAuthDiagnostics();
    expect(d.authMode).toBe('static_token');
    expect(d.configured).toBe(true);
    expect(JSON.stringify(d)).not.toContain('vercel_blob_rw_test_token');
  });

  it('builds immutable unique pathnames', () => {
    const svc = new VercelBlobReleaseStorageService({
      get: jest.fn((key: string, fallback?: string) =>
        key === 'storage.apkPrefix' ? 'releases/android' : fallback,
      ),
    } as never);
    expect(svc.buildApkObjectKey('relA')).toBe('releases/android/relA/Ruznamo.apk');
    expect(svc.buildApkObjectKey('relB')).not.toBe(svc.buildApkObjectKey('relA'));
  });
});
