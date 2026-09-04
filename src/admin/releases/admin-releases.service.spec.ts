import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
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
  const manifestSigner = {
    getStatus: jest.fn().mockReturnValue({
      configured: false,
      keyId: null,
      signatureAlgorithm: 'Ed25519',
    }),
    isConfigured: jest.fn().mockReturnValue(false),
    assertCanSign: jest.fn(),
    signRelease: jest.fn(),
  };

  const service = new AdminReleasesService(
    prisma as never,
    storage as never,
    inspector as never,
    manifestSigner as never,
  );

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

  it('finalizes a Blob object into DRAFT without production signer', async () => {
    storage.isConfigured.mockReturnValue(true);
    storage.isSigningPolicyConfigured.mockReturnValue(false);
    storage.head.mockResolvedValue({ exists: true, size: 12 });
    storage.getBuffer.mockResolvedValue(Buffer.from('apk-bytes'));
    inspector.inspect.mockResolvedValue({
      packageName: 'com.Tajroot.Ruznamo',
      versionName: '1.0.12',
      versionCode: 13,
      sha256: 'abc',
      fileSize: 12,
      signingCertificateSha256: 'debugcert',
    });
    prisma.appRelease.findFirst.mockResolvedValue(null);
    prisma.appRelease.findUnique.mockResolvedValue(null);
    prisma.appRelease.upsert.mockResolvedValue({
      id: 'rel_draft_1',
      platform: 'ANDROID',
      versionName: '1.0.12',
      versionCode: 13,
      packageName: 'com.Tajroot.Ruznamo',
      signingCertificateSha256: 'debugcert',
      objectKey: 'releases/android/abc/Ruznamo.apk',
      fileSize: BigInt(12),
      sha256: 'abc',
      status: 'DRAFT',
      mandatory: false,
      changelogRu: null,
      changelogTg: null,
      createdAt: new Date(),
      publishedAt: null,
      archivedAt: null,
    });

    const result = await service.finalizeUpload('admin-1', 'abc');
    expect(result.status).toBe('DRAFT');
    expect(result.versionCode).toBe(13);
    expect(result.packageName).toBe('com.Tajroot.Ruznamo');
    expect(storage.buildApkObjectKey).toHaveBeenCalledWith('abc');
    expect(storage.getBuffer).toHaveBeenCalledWith('releases/android/abc/Ruznamo.apk');
  });

  it('keeps Blob orphan when inspector throws unexpected runtime error', async () => {
    storage.isConfigured.mockReturnValue(true);
    storage.head.mockResolvedValue({ exists: true, size: 12 });
    storage.getBuffer.mockResolvedValue(Buffer.from('apk-bytes'));
    inspector.inspect.mockRejectedValue(new Error('adm_zip_1.default is not a constructor'));

    await expect(service.finalizeUpload('admin-1', 'abc')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(storage.delete).not.toHaveBeenCalled();
  });

  it('rejects publish when production signer is not configured', async () => {
    storage.isSigningPolicyConfigured.mockReturnValue(false);
    await expect(service.publish('rel_draft_1')).rejects.toBeInstanceOf(BadRequestException);
    await service.publish('rel_draft_1').catch((error: BadRequestException) => {
      expect(error.getResponse()).toMatchObject({ code: 'SIGNING_POLICY_NOT_CONFIGURED' });
    });
    expect(manifestSigner.assertCanSign).not.toHaveBeenCalled();
    expect(prisma.appRelease.update).not.toHaveBeenCalled();
  });

  it('rejects publish when manifest signing is not configured', async () => {
    storage.isSigningPolicyConfigured.mockReturnValue(true);
    manifestSigner.assertCanSign.mockImplementation(() => {
      throw new ServiceUnavailableException({
        code: 'MANIFEST_SIGNING_NOT_CONFIGURED',
        message: 'Release manifest signing key is not configured',
      });
    });

    await expect(service.publish('rel_draft_1')).rejects.toBeInstanceOf(ServiceUnavailableException);
    await service.publish('rel_draft_1').catch((error: ServiceUnavailableException) => {
      expect(error.getResponse()).toMatchObject({ code: 'MANIFEST_SIGNING_NOT_CONFIGURED' });
    });
    expect(prisma.appRelease.update).not.toHaveBeenCalled();
  });

  it('deletes DRAFT and Blob object', async () => {
    storage.isConfigured.mockReturnValue(true);
    prisma.appRelease.findUnique.mockResolvedValue({
      id: 'rel_draft_1',
      status: 'DRAFT',
      objectKey: 'releases/android/abc/Ruznamo.apk',
    });
    prisma.appRelease.delete.mockResolvedValue({});
    storage.delete.mockResolvedValue(undefined);

    const result = await service.deleteDraft('rel_draft_1');
    expect(result).toEqual({ deleted: true, id: 'rel_draft_1' });
    expect(storage.delete).toHaveBeenCalledWith('releases/android/abc/Ruznamo.apk');
  });

  it('rejects malformed finalize without uploadId', async () => {
    storage.isConfigured.mockReturnValue(true);
    await expect(service.finalizeUpload('admin-1', '   ')).rejects.toBeInstanceOf(BadRequestException);
    expect(storage.getBuffer).not.toHaveBeenCalled();
  });
});
