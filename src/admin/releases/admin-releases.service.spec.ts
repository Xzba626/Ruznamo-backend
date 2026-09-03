import { ServiceUnavailableException } from '@nestjs/common';
import { AdminReleasesService } from './admin-releases.service';

describe('AdminReleasesService Blob upload path', () => {
  const prisma = {
    appRelease: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
    },
    deviceInstallation: { count: jest.fn().mockResolvedValue(0) },
    appVersion: { findFirst: jest.fn(), update: jest.fn(), create: jest.fn() },
  };
  const storage = {
    isConfigured: jest.fn().mockReturnValue(false),
    isSigningPolicyConfigured: jest.fn().mockReturnValue(false),
    providerName: jest.fn().mockReturnValue('none'),
    getStorageDiagnostics: jest.fn().mockReturnValue({
      storeIdAvailable: false,
      authMode: 'none',
      configured: false,
      provider: 'none',
    }),
    buildApkObjectKey: jest.fn((id: string) => `releases/android/${id}/Ruznamo.apk`),
    createUploadAuthorization: jest.fn(),
    head: jest.fn(),
    getBuffer: jest.fn(),
    delete: jest.fn(),
    putObject: jest.fn(),
  };
  const inspector = { inspect: jest.fn() };

  const service = new AdminReleasesService(prisma as never, storage as never, inspector as never);

  beforeEach(() => {
    jest.clearAllMocks();
    storage.isConfigured.mockReturnValue(false);
  });

  it('rejects upload authorization when Blob is not configured', async () => {
    await expect(service.createUploadAuthorization('admin-1')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(storage.createUploadAuthorization).not.toHaveBeenCalled();
  });

  it('issues a pathname-scoped upload authorization when Blob is configured', async () => {
    storage.isConfigured.mockReturnValue(true);
    storage.createUploadAuthorization.mockResolvedValue({
      pathname: 'releases/android/abc/Ruznamo.apk',
      uploadUrl: 'https://blob.example/put',
      method: 'PUT',
      headers: { 'Content-Type': 'application/vnd.android.package-archive' },
      expiresAt: new Date().toISOString(),
      provider: 'vercel_blob',
    });

    const result = await service.createUploadAuthorization('admin-1', 35000000);
    expect(result.method).toBe('PUT');
    expect(result.uploadUrl).toContain('https://blob.example/put');
    expect(result.pathname).toContain('/Ruznamo.apk');
    expect(storage.createUploadAuthorization).toHaveBeenCalled();
  });

  it('runs storage smoke put/head/get/delete without leftover', async () => {
    storage.isConfigured.mockReturnValue(true);
    storage.getStorageDiagnostics.mockReturnValue({
      storeIdAvailable: true,
      authMode: 'oidc',
      configured: true,
      provider: 'vercel_blob',
    });
    storage.putObject.mockImplementation(async (_pathname: string, body: Buffer) => {
      storage.head
        .mockResolvedValueOnce({ exists: true, size: body.length })
        .mockResolvedValueOnce({ exists: false, size: 0 });
      storage.getBuffer.mockResolvedValue(body);
    });
    storage.delete.mockResolvedValue(undefined);

    const result = await service.runStorageSmokeTest('admin-1');
    expect(result.ok).toBe(true);
    expect(result.steps).toEqual({
      put: 'PASS',
      head: 'PASS',
      get: 'PASS',
      delete: 'PASS',
      postDelete: 'PASS',
    });
    expect(result.leftoverObject).toBe(false);
    expect(result.pathname).toMatch(/^healthchecks\/releases\//);
    expect(storage.putObject).toHaveBeenCalled();
    expect(storage.delete).toHaveBeenCalled();
  });
});
