import { AppReleaseStatus, Platform } from '@prisma/client';
import { AppUpdateService } from './app-update.service';

describe('AppUpdateService', () => {
  const prisma = {
    appRelease: {
      findFirst: jest.fn(),
    },
  };
  const storage = {
    isConfigured: jest.fn().mockReturnValue(true),
    getPublicUrl: jest.fn().mockReturnValue(null),
    getSignedDownloadUrl: jest.fn().mockResolvedValue('https://signed.example/apk'),
  };

  const service = new AppUpdateService(prisma as never, storage as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns no update when client is current', async () => {
    prisma.appRelease.findFirst.mockResolvedValue({
      versionCode: 10,
      versionName: '1.0.9',
      mandatory: false,
      fileSize: BigInt(1000),
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

    const result = await service.checkUpdate({ versionCode: 10, locale: 'ru' });
    expect(result.updateAvailable).toBe(false);
  });

  it('returns update when newer published release exists', async () => {
    prisma.appRelease.findFirst.mockResolvedValue({
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
    expect(result.latest?.versionCode).toBe(11);
    expect(result.latest?.changelog).toBe('tj notes');
  });
});
