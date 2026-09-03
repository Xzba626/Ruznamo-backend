import { AppUpdateService } from './app-update.service';
import { AppReleaseStatus, Platform } from '@prisma/client';

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

  const service = new AppUpdateService(prisma as never, storage as never);

  beforeEach(() => {
    jest.clearAllMocks();
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
  });

  it('returns metadata without a download URL when a newer release exists', async () => {
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
      publishedAt: new Date(),
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
    expect(storage.createDownloadAuthorization).not.toHaveBeenCalled();
  });

  it('issues a fresh signed URL only on download authorization', async () => {
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
    expect(auth.downloadUrl).toContain('https://blob.example/signed');
    expect(storage.createDownloadAuthorization).toHaveBeenCalled();
  });
});
