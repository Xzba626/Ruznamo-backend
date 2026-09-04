import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AppReleaseStatus, Platform, TelegramLanguage } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ReleaseStorageFacade } from '../storage/release-storage.facade';
import { ReleaseManifestSignerService } from './release-manifest/release-manifest.signer.service';

@Injectable()
export class AppUpdateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: ReleaseStorageFacade,
    private readonly manifestSigner: ReleaseManifestSignerService,
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
        signedManifest: null,
      };
    }

    // Fail closed: never hand Android unsigned authoritative metadata.
    const signedManifest = this.manifestSigner.signRelease(latest);

    const changelog =
      locale === 'tj' || locale === TelegramLanguage.TJ.toLowerCase()
        ? latest.changelogTg ?? ''
        : latest.changelogRu ?? '';

    return {
      updateAvailable: true,
      currentVersionCode: currentCode,
      releaseId: latest.id,
      latestVersionName: latest.versionName,
      latestVersionCode: latest.versionCode,
      latest: {
        releaseId: latest.id,
        versionName: latest.versionName,
        versionCode: latest.versionCode,
        mandatory: latest.mandatory,
        fileSize: Number(latest.fileSize),
        sha256: latest.sha256,
        packageName: latest.packageName,
        signingCertificateSha256: latest.signingCertificateSha256,
        changelog,
        publishedAt: latest.publishedAt?.toISOString() ?? null,
      },
      signedManifest: {
        manifest: signedManifest.manifest,
        signature: signedManifest.signature,
        signatureAlgorithm: signedManifest.signatureAlgorithm,
        keyId: signedManifest.keyId,
        // signedPayload is included so Android can verify without re-implementing
        // serialization bugs; algorithm docs still define how to rebuild it.
        signedPayload: signedManifest.signedPayload,
      },
    };
  }

  async authorizeDownload(releaseId: string) {
    const release = await this.prisma.appRelease.findUnique({ where: { id: releaseId } });
    if (!release) {
      throw new NotFoundException({ code: 'RELEASE_NOT_FOUND', message: 'Release not found' });
    }
    if (release.status !== AppReleaseStatus.PUBLISHED && release.status !== AppReleaseStatus.ARCHIVED) {
      throw new BadRequestException({
        code: 'RELEASE_NOT_DOWNLOADABLE',
        message: 'Release is not available for download',
      });
    }
    if (!this.storage.isConfigured()) {
      throw new BadRequestException({
        code: 'OBJECT_STORAGE_NOT_CONFIGURED',
        message: 'Object storage is not configured',
      });
    }

    const objectHead = await this.storage.head(release.objectKey);
    if (!objectHead.exists) {
      throw new BadRequestException({
        code: 'APK_FILE_MISSING',
        message: 'APK binary is missing from object storage',
      });
    }

    // Bind download to the same DB release identity Android verified via signed manifest.
    const auth = await this.storage.createDownloadAuthorization(release.objectKey, {
      expiresInSeconds: 300,
    });

    return {
      releaseId: release.id,
      versionName: release.versionName,
      versionCode: release.versionCode,
      fileSize: Number(release.fileSize),
      sha256: release.sha256,
      packageName: release.packageName,
      objectBound: true,
      downloadUrl: auth.downloadUrl,
      expiresAt: auth.expiresAt,
    };
  }
}
