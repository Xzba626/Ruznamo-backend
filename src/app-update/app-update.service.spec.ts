import { AppUpdateService } from './app-update.service';
import { AppReleaseStatus, Platform } from '@prisma/client';
import { generateEphemeralEd25519KeyPair } from './release-manifest/release-manifest.crypto';
import { ReleaseManifestSignerService } from './release-manifest/release-manifest.signer.service';

describe('AppUpdateService', () => {
  const prisma = {
    appRelease: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
  };
  const storage = {
    isConfigured: jest.fn().mockReturnValue(true),
    head: jest.fn().mockResolvedValue({ exists: true, size: 10 }),
    createDownloadAuthorization: jest.fn().mockResolvedValue({
      pathname: 'releases/android/x/Ruznamo.apk',
      downloadUrl: 'https://blob.example/signed',
      expiresAt: new Date().toISOString(),
      provider: 'vercel_blob',
    }),
  };
  const keys = generateEphemeralEd25519KeyPair();
  const manifestSigner = new ReleaseManifestSignerService();

  const service = new AppUpdateService(prisma as never, storage as never, manifestSigner);

  beforeEach(() => {
    jest.clearAllMocks();
    manifestSigner.resetCacheForTests();
    process.env.ANDROID_RELEASE_MANIFEST_PRIVATE_KEY = keys.privateKeyPkcs8Pem;
    process.env.ANDROID_RELEASE_MANIFEST_KEY_ID = 'rmk_test_1';
  });

  afterAll(() => {
    delete process.env.ANDROID_RELEASE_MANIFEST_PRIVATE_KEY;
    delete process.env.ANDROID_RELEASE_MANIFEST_KEY_ID;
  });

  it('returns no update when client is current', async () => {
    prisma.appRelease.findFirst.mockResolvedValue({
      id: 'rel_1',
      versionCode: 10,
      versionName: '1.0.9',
      status: AppReleaseStatus.PUBLISHED,
      platform: Platform.ANDROID,
    });

    const result = await service.checkUpdate({ versionCode: 10, locale: 'ru' });
    expect(result.updateAvailable).toBe(false);
    expect(result.latest).toBeNull();
    expect(result.signedManifest).toBeNull();
  });

  it('returns metadata + signedManifest without a download URL when a newer release exists', async () => {
    prisma.appRelease.findFirst.mockResolvedValue({
      id: 'rel_2',
      versionCode: 11,
      versionName: '1.0.10',
      mandatory: true,
      fileSize: BigInt(2000),
      sha256: 'abc',
      packageName: 'com.Tajroot.Ruznamo',
      signingCertificateSha256: 'def',
      changelogRu: 'ru notes',
      changelogTg: 'tj notes',
      publishedAt: new Date('2026-09-04T12:00:00.000Z'),
      objectKey: 'key',
      status: AppReleaseStatus.PUBLISHED,
      platform: Platform.ANDROID,
    });

    const result = await service.checkUpdate({ versionCode: 8, locale: 'tj' });
    expect(result.updateAvailable).toBe(true);
    expect(result.releaseId).toBe('rel_2');
    expect(result.latest?.versionCode).toBe(11);
    expect(result.latest?.changelog).toBe('tj notes');
    expect(result.latest).not.toHaveProperty('downloadUrl');
    expect(result.signedManifest?.keyId).toBe('rmk_test_1');
    expect(result.signedManifest?.signatureAlgorithm).toBe('Ed25519');
    expect(result.signedManifest?.manifest.releaseId).toBe('rel_2');
    expect(result.signedManifest?.signature).toBeTruthy();
    expect(JSON.stringify(result)).not.toMatch(/BEGIN PRIVATE KEY/);
    expect(storage.createDownloadAuthorization).not.toHaveBeenCalled();
  });

  it('does not treat DRAFT as an available client update', async () => {
    prisma.appRelease.findFirst.mockResolvedValue(null);
    const result = await service.checkUpdate({ versionCode: 1, locale: 'ru' });
    expect(result.updateAvailable).toBe(false);
    expect(prisma.appRelease.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: AppReleaseStatus.PUBLISHED }),
      }),
    );
  });

  it('refuses download authorization for DRAFT', async () => {
    prisma.appRelease.findUnique.mockResolvedValue({
      id: 'rel_draft',
      status: AppReleaseStatus.DRAFT,
      objectKey: 'releases/android/x/Ruznamo.apk',
    });
    await expect(service.authorizeDownload('rel_draft')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'RELEASE_NOT_DOWNLOADABLE' }),
    });
    expect(storage.createDownloadAuthorization).not.toHaveBeenCalled();
  });

  it('issues a fresh signed URL bound to the same releaseId/object', async () => {
    prisma.appRelease.findUnique.mockResolvedValue({
      id: 'rel_2',
      status: AppReleaseStatus.PUBLISHED,
      objectKey: 'releases/android/rel_2/Ruznamo.apk',
      versionName: '1.0.10',
      versionCode: 11,
      fileSize: BigInt(2000),
      sha256: 'abc',
      packageName: 'com.Tajroot.Ruznamo',
    });

    const auth = await service.authorizeDownload('rel_2');
    expect(auth.releaseId).toBe('rel_2');
    expect(auth.objectBound).toBe(true);
    expect(auth.downloadUrl).toContain('https://blob.example/signed');
    expect(storage.createDownloadAuthorization).toHaveBeenCalledWith(
      'releases/android/rel_2/Ruznamo.apk',
      expect.any(Object),
    );
  });

  it('fails closed when update exists but manifest signing is not configured', async () => {
    delete process.env.ANDROID_RELEASE_MANIFEST_PRIVATE_KEY;
    delete process.env.ANDROID_RELEASE_MANIFEST_KEY_ID;
    manifestSigner.resetCacheForTests();

    prisma.appRelease.findFirst.mockResolvedValue({
      id: 'rel_2',
      versionCode: 11,
      versionName: '1.0.10',
      mandatory: false,
      fileSize: BigInt(2000),
      sha256: 'abc',
      packageName: 'com.Tajroot.Ruznamo',
      signingCertificateSha256: 'def',
      changelogRu: 'ru',
      changelogTg: 'tj',
      publishedAt: new Date(),
      objectKey: 'key',
      status: AppReleaseStatus.PUBLISHED,
      platform: Platform.ANDROID,
    });

    await expect(service.checkUpdate({ versionCode: 1 })).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'MANIFEST_SIGNING_NOT_CONFIGURED' }),
    });
  });
});
