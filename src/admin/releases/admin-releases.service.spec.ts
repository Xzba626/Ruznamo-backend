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
    buildApkObjectKey: jest.fn((id: string) => `releases/android/${id}/Ruznamo.apk`),
    createUploadAuthorization: jest.fn(),
    head: jest.fn(),
    getBuffer: jest.fn(),
    delete: jest.fn(),
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
});
