import { Injectable } from '@nestjs/common';
import { AppReleaseStatus, Platform, TelegramLanguage } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ObjectStorageService } from '../storage/object-storage.service';

@Injectable()
export class AppUpdateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: ObjectStorageService,
  ) {}

  async checkUpdate(params: {
    platform?: Platform;
    versionCode?: number;
    locale?: string;
  }) {
    const platform = params.platform ?? Platform.ANDROID;
    const currentCode = params.versionCode ?? 0;
    const locale = (params.locale ?? 'ru').toLowerCase();

    const latest = await this.prisma.appRelease.findFirst({
      where: { platform, status: AppReleaseStatus.PUBLISHED },
      orderBy: { versionCode: 'desc' },
    });

    if (!latest || latest.versionCode <= currentCode) {
      return {
        updateAvailable: false,
        currentVersionCode: currentCode,
        latest: null,
      };
    }

    const changelog =
      locale === 'tj' || locale === TelegramLanguage.TJ.toLowerCase()
        ? latest.changelogTg ?? latest.changelogRu
        : latest.changelogRu ?? latest.changelogTg;

    let downloadUrl: string | null = null;
    if (this.storage.isConfigured()) {
      downloadUrl =
        this.storage.getPublicUrl(latest.objectKey) ??
        (await this.storage.getSignedDownloadUrl(latest.objectKey, 3600));
    }

    return {
      updateAvailable: true,
      currentVersionCode: currentCode,
      latest: {
        versionName: latest.versionName,
        versionCode: latest.versionCode,
        mandatory: latest.mandatory,
        fileSize: Number(latest.fileSize),
        sha256: latest.sha256,
        packageName: latest.packageName,
        signingCertificateSha256: latest.signingCertificateSha256,
        changelog,
        downloadUrl,
        publishedAt: latest.publishedAt?.toISOString() ?? null,
      },
    };
  }
}
