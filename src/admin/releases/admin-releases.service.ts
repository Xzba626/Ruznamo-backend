import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AppReleaseStatus, AuditActorType, Platform, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { ApkInspectorService } from '../../apk/apk-inspector.service';
import { AuditService } from '../../audit/audit.service';
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
    private readonly auditService: AuditService,
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
    const publishedCount = await this.prisma.appRelease.count({
      where: { platform, status: AppReleaseStatus.PUBLISHED },
    });
    return {
      storageConfigured: this.storage.isConfigured(),
      signingConfigured: this.storage.isSigningPolicyConfigured(),
      manifestSigningConfigured: manifestStatus.configured,
      manifestSigningKeyId: manifestStatus.keyId,
      manifestSignatureAlgorithm: manifestStatus.signatureAlgorithm,
      storageProvider: this.storage.providerName(),
      functionApkProxy: false,
      /** CRITICAL: must be 0 or 1. Values >1 are DATA_INTEGRITY_FAIL — never auto-remediated. */
      publishedCount,
      publishedInvariantOk: publishedCount <= 1,
      publishedReleases:
        publishedCount > 1
          ? (
              await this.prisma.appRelease.findMany({
                where: { platform, status: AppReleaseStatus.PUBLISHED },
                orderBy: { versionCode: 'desc' },
                select: {
                  id: true,
                  versionName: true,
                  versionCode: true,
                  publishedAt: true,
                  sha256: true,
                  objectKey: true,
                },
              })
            ).map((r) => ({
              id: r.id,
              versionName: r.versionName,
              versionCode: r.versionCode,
              publishedAt: r.publishedAt?.toISOString() ?? null,
              sha256: r.sha256,
              historicalObjectKey: r.objectKey,
            }))
          : undefined,
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

  async publish(releaseId: string, adminId?: string) {
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
    if (release.artifactDeletedAt) {
      throw new BadRequestException({
        code: 'APK_ARTIFACT_DELETED',
        message: 'Cannot publish a release whose APK artifact was deleted',
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
    let published;
    try {
      published = await this.prisma.$transaction(
        async (tx) => {
          // Serialize concurrent publish attempts for this platform.
          await tx.$executeRaw`
            SELECT pg_advisory_xact_lock(hashtext(${`ruznamo_publish_${release.platform}`}))
          `;

          await tx.appRelease.updateMany({
            where: {
              platform: release.platform,
              status: AppReleaseStatus.PUBLISHED,
              id: { not: release.id },
            },
            data: { status: AppReleaseStatus.ARCHIVED, archivedAt: now },
          });

          const updated = await tx.appRelease.update({
            where: { id: release.id },
            data: { status: AppReleaseStatus.PUBLISHED, publishedAt: now },
          });

          const publishedCount = await tx.appRelease.count({
            where: { platform: release.platform, status: AppReleaseStatus.PUBLISHED },
          });
          if (publishedCount !== 1) {
            throw new ConflictException({
              code: 'PUBLISHED_INVARIANT_VIOLATION',
              message: `Expected exactly one PUBLISHED release, found ${publishedCount}`,
            });
          }

          return updated;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === 'P2002' || error.code === 'P2034')
      ) {
        throw new ConflictException({
          code: 'PUBLISH_CONFLICT',
          message: 'Another publish is in progress or would create a second PUBLISHED release',
        });
      }
      throw error;
    }

    await this.syncLegacyAppVersion(published);
    await this.auditService.log({
      actorType: AuditActorType.ADMIN,
      actorId: adminId,
      action: 'release.published',
      entityType: 'AppRelease',
      entityId: published.id,
      metadata: {
        versionName: published.versionName,
        versionCode: published.versionCode,
        previousPublishedArchived: Boolean(latestPublished),
      },
    });
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

  /**
   * Delete physical APK from Private Blob for an ARCHIVED release.
   * Keeps the AppRelease row, SHA256, version, device analytics, and historical objectKey.
   * Never allowed for the current PUBLISHED release.
   */
  async purgeFile(releaseId: string, adminId?: string) {
    const release = await this.prisma.appRelease.findUnique({ where: { id: releaseId } });
    if (!release) {
      throw new NotFoundException({ code: 'RELEASE_NOT_FOUND', message: 'Release not found' });
    }
    if (release.status === AppReleaseStatus.PUBLISHED) {
      throw new BadRequestException({
        code: 'CANNOT_PURGE_PUBLISHED',
        message: 'Cannot delete APK of the current published production version',
      });
    }
    if (release.status === AppReleaseStatus.DRAFT) {
      throw new BadRequestException({
        code: 'PURGE_ARCHIVED_ONLY',
        message: 'Use delete draft to remove unpublished releases',
      });
    }
    if (release.status !== AppReleaseStatus.ARCHIVED && release.status !== AppReleaseStatus.PURGED) {
      throw new BadRequestException({
        code: 'PURGE_ARCHIVED_ONLY',
        message: 'Only archived releases can have their APK deleted',
      });
    }
    if (release.artifactDeletedAt || release.status === AppReleaseStatus.PURGED) {
      return this.serializeRelease(release);
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

    const now = new Date();
    const updated = await this.prisma.appRelease.update({
      where: { id: releaseId },
      data: {
        // Stay ARCHIVED — release is historical journal, not hard-deleted.
        status: AppReleaseStatus.ARCHIVED,
        artifactDeletedAt: now,
        artifactDeletedByAdminId: adminId ?? null,
        archivedAt: release.archivedAt ?? now,
      },
    });

    await this.auditService.log({
      actorType: AuditActorType.ADMIN,
      actorId: adminId,
      action: 'release.artifact_deleted',
      entityType: 'AppRelease',
      entityId: updated.id,
      metadata: {
        versionName: updated.versionName,
        versionCode: updated.versionCode,
        historicalObjectKey: updated.objectKey,
        sha256: updated.sha256,
      },
    });

    return this.serializeRelease(updated);
  }

  async getDownloadUrl(releaseId: string) {
    const release = await this.prisma.appRelease.findUnique({ where: { id: releaseId } });
    if (!release) {
      throw new NotFoundException({ code: 'RELEASE_NOT_FOUND', message: 'Release not found' });
    }
    if (this.isArtifactDeleted(release)) {
      throw new BadRequestException({
        code: 'APK_ARTIFACT_DELETED',
        message: 'APK file has been deleted from storage; release history remains',
      });
    }
    const auth = await this.storage.createDownloadAuthorization(release.objectKey, {
      expiresInSeconds: 300,
    });
    return { url: auth.downloadUrl, expiresAt: auth.expiresAt, release: this.serializeRelease(release) };
  }

  private isArtifactDeleted(release: {
    status: AppReleaseStatus;
    artifactDeletedAt?: Date | null;
  }): boolean {
    return Boolean(release.artifactDeletedAt) || release.status === AppReleaseStatus.PURGED;
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
    artifactDeletedAt?: Date | null;
  }) {
    const artifactDeleted = this.isArtifactDeleted(release);
    // Present legacy PURGED as ARCHIVED + artifact deleted for Admin UI.
    const statusForUi =
      release.status === AppReleaseStatus.PURGED ? AppReleaseStatus.ARCHIVED : release.status;
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
      status: statusForUi,
      mandatory: release.mandatory,
      changelogRu: release.changelogRu,
      changelogTg: release.changelogTg,
      createdAt: release.createdAt.toISOString(),
      publishedAt: release.publishedAt?.toISOString() ?? null,
      archivedAt: release.archivedAt?.toISOString() ?? null,
      artifactAvailable: !artifactDeleted,
      artifactDeletedAt: release.artifactDeletedAt?.toISOString() ?? null,
      /** Historical Blob pathname only — not a live download URL when artifact deleted. */
      historicalObjectKey: release.objectKey,
      filePurged: artifactDeleted,
      canDeleteArtifact: statusForUi === AppReleaseStatus.ARCHIVED && !artifactDeleted,
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
