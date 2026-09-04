import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AppReleaseStatus, Platform } from '@prisma/client';
import { randomUUID } from 'crypto';
import { ApkInspectorService } from '../../apk/apk-inspector.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ReleaseStorageFacade } from '../../storage/release-storage.facade';
import { ReleaseManifestSignerService } from '../../app-update/release-manifest/release-manifest.signer.service';
import { formatAppVersionLabel } from '../../devices/device-metadata.util';

@Injectable()
export class AdminReleasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: ReleaseStorageFacade,
    private readonly apkInspector: ApkInspectorService,
    private readonly manifestSigner: ReleaseManifestSignerService,
  ) {}

  async getOverview(platform: Platform = Platform.ANDROID) {
    const [latestPublished, releases, activeDevices] = await Promise.all([
      this.prisma.appRelease.findFirst({
        where: { platform, status: AppReleaseStatus.PUBLISHED },
        orderBy: { versionCode: 'desc' },
      }),
      this.prisma.appRelease.findMany({
        where: { platform },
        orderBy: { versionCode: 'desc' },
        take: 50,
      }),
      this.prisma.deviceInstallation.count({
        where: { revokedAt: null, appVersionCode: { not: null } },
      }),
    ]);

    const adoption = latestPublished
      ? await this.countAdoption(latestPublished.versionCode, activeDevices)
      : { count: 0, percent: 0 };

    const diagnostics = this.storage.getStorageDiagnostics();
    const manifestStatus = this.manifestSigner.getStatus();
    return {
      storageConfigured: this.storage.isConfigured(),
      signingConfigured: this.storage.isSigningPolicyConfigured(),
      manifestSigningConfigured: manifestStatus.configured,
      manifestSigningKeyId: manifestStatus.keyId,
      manifestSignatureAlgorithm: manifestStatus.signatureAlgorithm,
      storageProvider: this.storage.providerName(),
      functionApkProxy: false,
      storageDiagnostics: {
        storeIdAvailable: diagnostics.storeIdAvailable,
        authMode: diagnostics.authMode,
        provider: diagnostics.provider,
      },
      current: latestPublished
        ? {
            ...this.serializeRelease(latestPublished),
            adoption,
          }
        : null,
      history: await Promise.all(
        releases.map(async (release) => ({
          ...this.serializeRelease(release),
          deviceCount: await this.prisma.deviceInstallation.count({
            where: { revokedAt: null, appVersionCode: release.versionCode },
          }),
        })),
      ),
    };
  }

  /**
   * Production-safe Blob smoke: PUT → HEAD → GET → DELETE → prove gone.
   * Uses a unique non-release pathname; never publishes AppRelease.
   */
  async runStorageSmokeTest(adminId: string) {
    if (!this.storage.isConfigured()) {
      throw new ServiceUnavailableException({
        code: 'OBJECT_STORAGE_NOT_CONFIGURED',
        message: 'Vercel Private Blob is not configured',
      });
    }

    const diagnostics = this.storage.getStorageDiagnostics();
    const pathname = `healthchecks/releases/${randomUUID()}.txt`;
    const payload = Buffer.from(
      `ruznamo-blob-smoke admin=${adminId} at=${new Date().toISOString()}`,
      'utf8',
    );
    const steps: Record<string, 'PASS' | 'FAIL'> = {
      put: 'FAIL',
      head: 'FAIL',
      get: 'FAIL',
      delete: 'FAIL',
      postDelete: 'FAIL',
    };

    try {
      await this.storage.putObject(pathname, payload, 'text/plain');
      steps.put = 'PASS';

      const afterPut = await this.storage.head(pathname);
      if (!afterPut.exists || afterPut.size !== payload.length) {
        throw new Error('HEAD after PUT failed');
      }
      steps.head = 'PASS';

      const got = await this.storage.getBuffer(pathname);
      if (got.toString('utf8') !== payload.toString('utf8')) {
        throw new Error('GET content mismatch');
      }
      steps.get = 'PASS';

      await this.storage.delete(pathname);
      steps.delete = 'PASS';

      const afterDelete = await this.storage.head(pathname);
      if (afterDelete.exists) {
        throw new Error('Object still exists after DELETE');
      }
      steps.postDelete = 'PASS';
    } catch (error) {
      await this.storage.delete(pathname).catch(() => undefined);
      throw new ServiceUnavailableException({
        code: 'BLOB_SMOKE_FAILED',
        message: error instanceof Error ? error.message : 'Blob smoke test failed',
        details: {
          pathname,
          steps,
          storeIdAvailable: diagnostics.storeIdAvailable,
          authMode: diagnostics.authMode,
          provider: diagnostics.provider,
        },
      });
    }

    return {
      ok: true,
      pathname,
      steps,
      storeIdAvailable: diagnostics.storeIdAvailable,
      authMode: diagnostics.authMode,
      provider: diagnostics.provider,
      leftoverObject: false,
    };
  }

  async createUploadAuthorization(adminId: string, declaredFileSize?: number) {
    if (!this.storage.isConfigured()) {
      throw new ServiceUnavailableException({
        code: 'OBJECT_STORAGE_NOT_CONFIGURED',
        message: 'Configure Vercel Private Blob before uploading APK releases',
      });
    }

    const uploadId = randomUUID().replace(/-/g, '');
    const pathname = this.storage.buildApkObjectKey(uploadId);
    const auth = await this.storage.createUploadAuthorization(pathname, {
      maximumSizeInBytes: declaredFileSize && declaredFileSize > 0 ? declaredFileSize : undefined,
    });

    return {
      uploadId,
      pathname: auth.pathname,
      uploadUrl: auth.uploadUrl,
      method: auth.method,
      headers: auth.headers,
      expiresAt: auth.expiresAt,
      provider: auth.provider,
      createdByAdminId: adminId,
    };
  }

  async finalizeUpload(adminId: string, uploadId: string) {
    if (!this.storage.isConfigured()) {
      throw new ServiceUnavailableException({
        code: 'OBJECT_STORAGE_NOT_CONFIGURED',
        message: 'Object storage is not configured',
      });
    }
    if (!uploadId?.trim()) {
      throw new BadRequestException({ code: 'UPLOAD_ID_REQUIRED', message: 'uploadId is required' });
    }

    const pathname = this.storage.buildApkObjectKey(uploadId.trim());
    const objectHead = await this.storage.head(pathname);
    if (!objectHead.exists) {
      throw new BadRequestException({
        code: 'APK_FILE_MISSING',
        message: 'APK was not found in Blob after upload',
      });
    }

    const buffer = await this.storage.getBuffer(pathname);
    let inspected;
    try {
      inspected = await this.apkInspector.inspect(buffer);
    } catch (error) {
      const isClientApkError =
        error instanceof BadRequestException &&
        typeof error.getResponse() === 'object' &&
        error.getResponse() !== null &&
        String((error.getResponse() as { code?: string }).code ?? '').startsWith('APK_');
      const isInvalid =
        error instanceof BadRequestException &&
        typeof error.getResponse() === 'object' &&
        error.getResponse() !== null &&
        ['INVALID_APK', 'INVALID_APK_METADATA', 'APK_PACKAGE_MISMATCH', 'APK_SIGNING_MISMATCH'].includes(
          String((error.getResponse() as { code?: string }).code ?? ''),
        );

      if (isInvalid || isClientApkError) {
        await this.storage.delete(pathname).catch(() => undefined);
        throw error;
      }

      // Keep Blob object for resume when inspector/runtime fails unexpectedly.
      throw new ServiceUnavailableException({
        code: 'APK_INSPECT_FAILED',
        message:
          error instanceof Error
            ? `APK inspection failed: ${error.message}`
            : 'APK inspection failed',
        details: { pathname, uploadId: uploadId.trim(), orphanRetained: true },
      });
    }

    if (objectHead.size > 0 && objectHead.size !== inspected.fileSize) {
      await this.storage.delete(pathname).catch(() => undefined);
      throw new BadRequestException({
        code: 'APK_SIZE_MISMATCH',
        message: 'Uploaded Blob size does not match APK content',
      });
    }

    const latestPublished = await this.prisma.appRelease.findFirst({
      where: { platform: Platform.ANDROID, status: AppReleaseStatus.PUBLISHED },
      orderBy: { versionCode: 'desc' },
    });
    if (latestPublished && inspected.versionCode <= latestPublished.versionCode) {
      await this.storage.delete(pathname).catch(() => undefined);
      throw new BadRequestException({
        code: 'VERSION_CODE_NOT_INCREASING',
        message: `versionCode must be greater than ${latestPublished.versionCode}`,
      });
    }

    const existing = await this.prisma.appRelease.findUnique({
      where: {
        platform_versionCode: {
          platform: Platform.ANDROID,
          versionCode: inspected.versionCode,
        },
      },
    });
    if (existing && existing.status !== AppReleaseStatus.DRAFT) {
      await this.storage.delete(pathname).catch(() => undefined);
      throw new BadRequestException({
        code: 'VERSION_CODE_EXISTS',
        message: 'A release with this versionCode already exists',
      });
    }

    if (existing?.objectKey && existing.objectKey !== pathname) {
      await this.storage.delete(existing.objectKey).catch(() => undefined);
    }

    const release = await this.prisma.appRelease.upsert({
      where: {
        platform_versionCode: {
          platform: Platform.ANDROID,
          versionCode: inspected.versionCode,
        },
      },
      create: {
        platform: Platform.ANDROID,
        versionName: inspected.versionName,
        versionCode: inspected.versionCode,
        packageName: inspected.packageName,
        signingCertificateSha256: inspected.signingCertificateSha256,
        objectKey: pathname,
        fileSize: BigInt(inspected.fileSize),
        sha256: inspected.sha256,
        status: AppReleaseStatus.DRAFT,
        createdByAdminId: adminId,
      },
      update: {
        versionName: inspected.versionName,
        packageName: inspected.packageName,
        signingCertificateSha256: inspected.signingCertificateSha256,
        objectKey: pathname,
        fileSize: BigInt(inspected.fileSize),
        sha256: inspected.sha256,
        status: AppReleaseStatus.DRAFT,
        createdByAdminId: adminId,
      },
    });

    return this.serializeRelease(release);
  }

  async updateDraft(
    releaseId: string,
    data: { changelogRu?: string; changelogTg?: string; mandatory?: boolean },
  ) {
    const release = await this.prisma.appRelease.findUnique({ where: { id: releaseId } });
    if (!release) {
      throw new NotFoundException({ code: 'RELEASE_NOT_FOUND', message: 'Release not found' });
    }
    if (release.status !== AppReleaseStatus.DRAFT) {
      throw new BadRequestException({
        code: 'RELEASE_NOT_DRAFT',
        message: 'Only draft releases can be edited',
      });
    }

    const updated = await this.prisma.appRelease.update({
      where: { id: releaseId },
      data: {
        changelogRu: data.changelogRu,
        changelogTg: data.changelogTg,
        mandatory: data.mandatory,
      },
    });
    return this.serializeRelease(updated);
  }

  async publish(releaseId: string) {
    if (!this.storage.isSigningPolicyConfigured()) {
      throw new BadRequestException({
        code: 'SIGNING_POLICY_NOT_CONFIGURED',
        message: 'Configure production signing certificate before publishing releases',
      });
    }

    // Fail closed: Android expects a signed release manifest for every PUBLISHED update.
    this.manifestSigner.assertCanSign();

    const release = await this.prisma.appRelease.findUnique({ where: { id: releaseId } });
    if (!release) {
      throw new NotFoundException({ code: 'RELEASE_NOT_FOUND', message: 'Release not found' });
    }
    if (release.status === AppReleaseStatus.PUBLISHED) {
      return this.serializeRelease(release);
    }
    if (release.status !== AppReleaseStatus.DRAFT) {
      throw new BadRequestException({
        code: 'RELEASE_NOT_DRAFT',
        message: 'Only draft releases can be published',
      });
    }

    const expectedPackage = (
      process.env.ANDROID_PACKAGE_NAME ?? 'com.Tajroot.Ruznamo'
    ).trim();
    if (release.packageName !== expectedPackage) {
      throw new BadRequestException({
        code: 'APK_PACKAGE_MISMATCH',
        message: `Expected package ${expectedPackage}, got ${release.packageName}`,
      });
    }

    const allowedCert = (process.env.ANDROID_RELEASE_SIGNING_CERT_SHA256 ?? '')
      .trim()
      .toLowerCase();
    if (!allowedCert || release.signingCertificateSha256.toLowerCase() !== allowedCert) {
      throw new BadRequestException({
        code: 'APK_SIGNING_MISMATCH',
        message: 'APK signing certificate does not match configured release identity',
      });
    }

    if (!release.changelogRu?.trim() || !release.changelogTg?.trim()) {
      throw new BadRequestException({
        code: 'CHANGELOG_REQUIRED',
        message: 'Localized changelog is required in Russian and Tajik before publish',
      });
    }

    const latestPublished = await this.prisma.appRelease.findFirst({
      where: { platform: release.platform, status: AppReleaseStatus.PUBLISHED },
      orderBy: { versionCode: 'desc' },
    });
    if (latestPublished && release.versionCode <= latestPublished.versionCode) {
      throw new BadRequestException({
        code: 'VERSION_CODE_NOT_INCREASING',
        message: `versionCode must be greater than ${latestPublished.versionCode}`,
      });
    }

    const objectHead = await this.storage.head(release.objectKey);
    if (!objectHead.exists) {
      throw new BadRequestException({
        code: 'APK_FILE_MISSING',
        message: 'APK binary is missing from object storage',
      });
    }

    const now = new Date();
    const published = await this.prisma.$transaction(async (tx) => {
      await tx.appRelease.updateMany({
        where: {
          platform: release.platform,
          status: AppReleaseStatus.PUBLISHED,
          id: { not: release.id },
        },
        data: { status: AppReleaseStatus.ARCHIVED, archivedAt: now },
      });

      return tx.appRelease.update({
        where: { id: release.id },
        data: { status: AppReleaseStatus.PUBLISHED, publishedAt: now },
      });
    });

    await this.syncLegacyAppVersion(published);
    return this.serializeRelease(published);
  }

  async archive(releaseId: string) {
    const release = await this.prisma.appRelease.findUnique({ where: { id: releaseId } });
    if (!release) {
      throw new NotFoundException({ code: 'RELEASE_NOT_FOUND', message: 'Release not found' });
    }
    if (release.status === AppReleaseStatus.PUBLISHED) {
      throw new BadRequestException({
        code: 'CANNOT_ARCHIVE_ONLY_PUBLISHED',
        message: 'Publish a replacement before archiving the current published APK',
      });
    }
    const updated = await this.prisma.appRelease.update({
      where: { id: releaseId },
      data: { status: AppReleaseStatus.ARCHIVED, archivedAt: new Date() },
    });
    return this.serializeRelease(updated);
  }

  async deleteDraft(releaseId: string) {
    const release = await this.prisma.appRelease.findUnique({ where: { id: releaseId } });
    if (!release) {
      throw new NotFoundException({ code: 'RELEASE_NOT_FOUND', message: 'Release not found' });
    }
    if (release.status !== AppReleaseStatus.DRAFT) {
      throw new BadRequestException({
        code: 'RELEASE_NOT_DRAFT',
        message: 'Only draft releases can be deleted',
      });
    }

    if (this.storage.isConfigured()) {
      try {
        await this.storage.delete(release.objectKey);
      } catch {
        throw new ServiceUnavailableException({
          code: 'BLOB_DELETE_FAILED',
          message: 'Could not delete APK from Blob. Retry draft delete.',
        });
      }
    }

    await this.prisma.appRelease.delete({ where: { id: release.id } });
    return { deleted: true, id: releaseId };
  }

  async purgeFile(releaseId: string) {
    const release = await this.prisma.appRelease.findUnique({ where: { id: releaseId } });
    if (!release) {
      throw new NotFoundException({ code: 'RELEASE_NOT_FOUND', message: 'Release not found' });
    }
    if (release.status === AppReleaseStatus.PUBLISHED) {
      throw new BadRequestException({
        code: 'CANNOT_PURGE_PUBLISHED',
        message: 'Publish a replacement before purging the current published APK',
      });
    }
    if (release.status !== AppReleaseStatus.ARCHIVED) {
      throw new BadRequestException({
        code: 'PURGE_ARCHIVED_ONLY',
        message: 'Only archived releases can be purged',
      });
    }

    if (this.storage.isConfigured()) {
      try {
        await this.storage.delete(release.objectKey);
      } catch {
        throw new ServiceUnavailableException({
          code: 'BLOB_DELETE_FAILED',
          message: 'Could not delete APK from Blob. Retry purge.',
        });
      }
    }

    const updated = await this.prisma.appRelease.update({
      where: { id: releaseId },
      data: { status: AppReleaseStatus.PURGED },
    });
    return this.serializeRelease(updated);
  }

  async getDownloadUrl(releaseId: string) {
    const release = await this.prisma.appRelease.findUnique({ where: { id: releaseId } });
    if (!release) {
      throw new NotFoundException({ code: 'RELEASE_NOT_FOUND', message: 'Release not found' });
    }
    if (release.status === AppReleaseStatus.PURGED) {
      throw new BadRequestException({ code: 'APK_PURGED', message: 'APK file has been purged' });
    }
    const auth = await this.storage.createDownloadAuthorization(release.objectKey, {
      expiresInSeconds: 300,
    });
    return { url: auth.downloadUrl, expiresAt: auth.expiresAt, release: this.serializeRelease(release) };
  }

  private async countAdoption(versionCode: number, activeDevices: number) {
    const count = await this.prisma.deviceInstallation.count({
      where: { revokedAt: null, appVersionCode: versionCode },
    });
    const percent = activeDevices > 0 ? Math.round((count / activeDevices) * 100) : 0;
    return { count, percent };
  }

  private serializeRelease(release: {
    id: string;
    platform: Platform;
    versionName: string;
    versionCode: number;
    packageName: string;
    signingCertificateSha256: string;
    objectKey: string;
    fileSize: bigint;
    sha256: string;
    status: AppReleaseStatus;
    mandatory: boolean;
    changelogRu: string | null;
    changelogTg: string | null;
    createdAt: Date;
    publishedAt: Date | null;
    archivedAt: Date | null;
  }) {
    return {
      id: release.id,
      platform: release.platform,
      versionLabel: formatAppVersionLabel({
        appVersionName: release.versionName,
        appVersionCode: release.versionCode,
      }),
      versionName: release.versionName,
      versionCode: release.versionCode,
      packageName: release.packageName,
      signingCertificateSha256: release.signingCertificateSha256,
      fileSize: Number(release.fileSize),
      sha256: release.sha256,
      status: release.status,
      mandatory: release.mandatory,
      changelogRu: release.changelogRu,
      changelogTg: release.changelogTg,
      createdAt: release.createdAt.toISOString(),
      publishedAt: release.publishedAt?.toISOString() ?? null,
      archivedAt: release.archivedAt?.toISOString() ?? null,
      filePurged: release.status === AppReleaseStatus.PURGED,
    };
  }

  private async syncLegacyAppVersion(release: {
    platform: Platform;
    versionName: string;
    mandatory: boolean;
    changelogRu: string | null;
    changelogTg: string | null;
  }) {
    const existing = await this.prisma.appVersion.findFirst({
      where: { platform: release.platform, isActive: true },
      orderBy: { updatedAt: 'desc' },
    });
    if (existing) {
      await this.prisma.appVersion.update({
        where: { id: existing.id },
        data: {
          latestVersion: release.versionName,
          minimumSupportedVersion: existing.minimumSupportedVersion,
          forceUpdate: release.mandatory,
          releaseNotes: release.changelogRu,
          releaseNotesTj: release.changelogTg,
        },
      });
      return;
    }
    await this.prisma.appVersion.create({
      data: {
        platform: release.platform,
        latestVersion: release.versionName,
        minimumSupportedVersion: release.versionName,
        forceUpdate: release.mandatory,
        releaseNotes: release.changelogRu,
        releaseNotesTj: release.changelogTg,
        isActive: true,
      },
    });
  }
}
