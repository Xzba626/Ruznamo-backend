import { Injectable, NotFoundException } from '@nestjs/common';
import { LicenseStatus, Prisma, TrialGrantStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { paginateMeta } from '../common/dto/pagination.dto';
import { formatAppVersionLabel } from '../../devices/device-metadata.util';
import {
  classifyInstallationAccess,
  evaluateInstallationIntegrity,
  mapBucketToEffectiveStatus,
} from '../../devices/installation-integrity.util';
import { AdminDevicesQueryDto } from './dto/admin-devices-query.dto';

type DeviceListRow = {
  id: string;
  installationId: string;
  deviceName: string | null;
  deviceManufacturer: string | null;
  deviceModel: string | null;
  androidOsVersion: string | null;
  sdkLevel: number | null;
  themeMode: string | null;
  packageName: string | null;
  appLocale: string | null;
  appLanguage: string | null;
  appVersion: string | null;
  appVersionName: string | null;
  appVersionCode: number | null;
  platform: string;
  lastSeenAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
  clientReportedAccessState: string | null;
  clientReportedAccessAt: Date | null;
  user: {
    id: string;
    displayName: string | null;
    email: string | null;
    status: string;
    category: string;
    trialGrant: {
      status: TrialGrantStatus;
      expiresAt: Date;
      startedAt: Date;
    } | null;
    licenses: Array<{
      id: string;
      status: LicenseStatus;
      keyPrefix: string;
      startsAt: Date | null;
      expiresAt: Date | null;
      revokedAt: Date | null;
    }>;
  };
  activations: Array<{
    license: {
      id: string;
      status: LicenseStatus;
      keyPrefix: string;
      startsAt: Date | null;
      expiresAt: Date | null;
      revokedAt: Date | null;
    };
  }>;
};

@Injectable()
export class AdminDevicesService {
  constructor(private readonly prisma: PrismaService) {}

  async stats() {
    const now = new Date();
    const activeSince = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [total, active30d, devices] = await Promise.all([
      this.prisma.deviceInstallation.count(),
      this.prisma.deviceInstallation.count({
        where: { lastSeenAt: { gte: activeSince } },
      }),
      this.prisma.deviceInstallation.findMany({
        select: {
          id: true,
          revokedAt: true,
          user: {
            select: {
              trialGrant: { select: { status: true, expiresAt: true } },
              licenses: {
                where: { status: LicenseStatus.ACTIVE },
                select: { id: true },
                take: 1,
              },
            },
          },
          activations: {
            where: { revokedAt: null, license: { status: LicenseStatus.ACTIVE } },
            select: { id: true },
            take: 1,
          },
        },
      }),
    ]);

    let trial = 0;
    let licensed = 0;
    let trialExpired = 0;
    let revoked = 0;
    let review = 0;

    // Integrity REVIEW count requires clientReported — separate cheap query
    const reviewCandidates = await this.prisma.deviceInstallation.findMany({
      where: { clientReportedAccessState: { not: null } },
      select: {
        clientReportedAccessState: true,
        revokedAt: true,
        user: {
          select: {
            trialGrant: { select: { status: true, expiresAt: true } },
            licenses: {
              where: { status: { in: [LicenseStatus.ACTIVE, LicenseStatus.REVOKED, LicenseStatus.SUSPENDED] } },
              select: { status: true },
              take: 3,
            },
          },
        },
        activations: {
          where: { revokedAt: null },
          select: { license: { select: { status: true } } },
          take: 1,
        },
      },
    });

    for (const d of devices) {
      const bucket = classifyInstallationAccess({
        deviceRevokedAt: d.revokedAt,
        hasActiveLicenseOnDevice: d.activations.length > 0,
        hasActiveLicenseOnUser: d.user.licenses.length > 0,
        trialStatus: d.user.trialGrant?.status ?? null,
        trialExpiresAt: d.user.trialGrant?.expiresAt ?? null,
      });
      if (bucket === 'LICENSED') licensed += 1;
      else if (bucket === 'TRIAL') trial += 1;
      else if (bucket === 'TRIAL_EXPIRED') trialExpired += 1;
      else if (bucket === 'REVOKED') revoked += 1;
    }

    for (const d of reviewCandidates) {
      const bucket = classifyInstallationAccess({
        deviceRevokedAt: d.revokedAt,
        hasActiveLicenseOnDevice: d.activations.some((a) => a.license.status === LicenseStatus.ACTIVE),
        hasActiveLicenseOnUser: d.user.licenses.some((l) => l.status === LicenseStatus.ACTIVE),
        trialStatus: d.user.trialGrant?.status ?? null,
        trialExpiresAt: d.user.trialGrant?.expiresAt ?? null,
      });
      const licenseStatus =
        d.activations[0]?.license.status ??
        d.user.licenses.find((l) => l.status !== LicenseStatus.ACTIVE)?.status ??
        d.user.licenses[0]?.status ??
        null;
      const integrity = evaluateInstallationIntegrity({
        clientReportedAccessState: d.clientReportedAccessState,
        serverEffectiveStatus: mapBucketToEffectiveStatus(bucket),
        deviceRevokedAt: d.revokedAt,
        licenseStatus,
      });
      if (integrity.status === 'REVIEW') review += 1;
    }

    return {
      total,
      active30d,
      trial,
      licensed,
      trialExpired,
      revoked,
      review,
      countedBy: 'installationId' as const,
    };
  }

  async list(query: AdminDevicesQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.DeviceInstallationWhereInput = query.search
      ? {
          OR: [
            { installationId: { contains: query.search, mode: 'insensitive' } },
            { deviceName: { contains: query.search, mode: 'insensitive' } },
            { deviceModel: { contains: query.search, mode: 'insensitive' } },
            { deviceManufacturer: { contains: query.search, mode: 'insensitive' } },
            { user: { displayName: { contains: query.search, mode: 'insensitive' } } },
            { user: { email: { contains: query.search, mode: 'insensitive' } } },
          ],
        }
      : {};

    // Fetch a larger window when filters need post-processing; keep simple for MVP.
    const fetchLimit =
      query.integrityStatus || query.accessBucket ? Math.min(500, limit * 10) : limit;
    const fetchSkip = query.integrityStatus || query.accessBucket ? 0 : skip;

    const [rawItems, totalRaw] = await Promise.all([
      this.prisma.deviceInstallation.findMany({
        where,
        skip: fetchSkip,
        take: fetchLimit,
        orderBy: { lastSeenAt: 'desc' },
        include: this.listInclude(),
      }),
      this.prisma.deviceInstallation.count({ where }),
    ]);

    let mapped = rawItems.map((device) => this.toAdminRow(device));

    if (query.accessBucket) {
      mapped = mapped.filter((row) => row.accessBucket === query.accessBucket);
    }
    if (query.integrityStatus) {
      mapped = mapped.filter((row) => row.integrity.status === query.integrityStatus);
    }

    const filteredTotal =
      query.integrityStatus || query.accessBucket ? mapped.length : totalRaw;
    const pageItems =
      query.integrityStatus || query.accessBucket
        ? mapped.slice(skip, skip + limit)
        : mapped;

    return {
      items: pageItems,
      meta: paginateMeta(filteredTotal, page, limit),
    };
  }

  async getById(id: string) {
    const device = await this.prisma.deviceInstallation.findUnique({
      where: { id },
      include: this.listInclude(),
    });
    if (!device) {
      throw new NotFoundException({
        code: 'DEVICE_NOT_FOUND',
        message: 'Installation not found',
      });
    }
    return this.toAdminDetail(device);
  }

  private listInclude() {
    return {
      user: {
        select: {
          id: true,
          displayName: true,
          email: true,
          status: true,
          category: true,
          trialGrant: true,
          licenses: {
            where: {
              status: {
                in: [
                  LicenseStatus.ACTIVE,
                  LicenseStatus.EXPIRED,
                  LicenseStatus.REVOKED,
                  LicenseStatus.SUSPENDED,
                  LicenseStatus.PENDING,
                ],
              },
            },
            select: {
              id: true,
              status: true,
              keyPrefix: true,
              startsAt: true,
              expiresAt: true,
              revokedAt: true,
            },
            orderBy: { updatedAt: 'desc' as const },
            take: 3,
          },
        },
      },
      activations: {
        where: { revokedAt: null },
        include: {
          license: {
            select: {
              id: true,
              status: true,
              keyPrefix: true,
              startsAt: true,
              expiresAt: true,
              revokedAt: true,
            },
          },
        },
      },
    } satisfies Prisma.DeviceInstallationInclude;
  }

  private toAdminRow(device: DeviceListRow) {
    const activeLicenseOnDevice = device.activations.find(
      (a) => a.license.status === LicenseStatus.ACTIVE,
    );
    const activeLicenseOnUser = device.user.licenses.find((l) => l.status === LicenseStatus.ACTIVE);
    const anyLicense = activeLicenseOnDevice?.license ?? activeLicenseOnUser ?? device.user.licenses[0] ?? null;

    const accessBucket = classifyInstallationAccess({
      deviceRevokedAt: device.revokedAt,
      hasActiveLicenseOnDevice: Boolean(activeLicenseOnDevice),
      hasActiveLicenseOnUser: Boolean(activeLicenseOnUser),
      trialStatus: device.user.trialGrant?.status ?? null,
      trialExpiresAt: device.user.trialGrant?.expiresAt ?? null,
    });

    const integrity = evaluateInstallationIntegrity({
      clientReportedAccessState: device.clientReportedAccessState,
      serverEffectiveStatus: mapBucketToEffectiveStatus(accessBucket),
      deviceRevokedAt: device.revokedAt,
      licenseStatus: anyLicense?.status ?? null,
    });

    const trial = device.user.trialGrant;
    const trialExpired =
      trial &&
      (trial.status === TrialGrantStatus.EXPIRED ||
        (trial.status === TrialGrantStatus.ACTIVE && trial.expiresAt.getTime() <= Date.now()));

    return {
      id: device.id,
      installationId: device.installationId,
      deviceName: device.deviceName,
      deviceManufacturer: device.deviceManufacturer,
      deviceModel: device.deviceModel,
      androidOsVersion: device.androidOsVersion,
      sdkLevel: device.sdkLevel,
      themeMode: device.themeMode,
      packageName: device.packageName,
      appLocale: device.appLocale,
      appLanguage: device.appLanguage,
      appVersion: device.appVersion,
      appVersionName: device.appVersionName,
      appVersionCode: device.appVersionCode,
      appVersionLabel:
        formatAppVersionLabel(device) ?? (device.appVersion ? device.appVersion : null),
      appVersionUnknown: !formatAppVersionLabel(device) && !device.appVersion,
      platform: device.platform,
      lastSeenAt: device.lastSeenAt,
      revokedAt: device.revokedAt,
      isActive: device.revokedAt === null,
      createdAt: device.createdAt,
      firstSeenAt: device.createdAt,
      accessBucket,
      serverEffectiveStatus: mapBucketToEffectiveStatus(accessBucket),
      clientReportedAccessState: device.clientReportedAccessState,
      clientReportedAccessAt: device.clientReportedAccessAt,
      integrity,
      roleId: device.user.category,
      displayName: device.user.displayName,
      trial: trial
        ? {
            status: trialExpired && trial.status === TrialGrantStatus.ACTIVE ? 'EXPIRED' : trial.status,
            expiresAt: trial.expiresAt,
            startedAt: trial.startedAt,
          }
        : null,
      license: anyLicense
        ? {
            id: anyLicense.id,
            status: anyLicense.status,
            keyPrefix: anyLicense.keyPrefix,
            startsAt: anyLicense.startsAt,
            expiresAt: anyLicense.expiresAt,
            boundToThisInstallation: Boolean(activeLicenseOnDevice),
          }
        : null,
      user: {
        id: device.user.id,
        displayName: device.user.displayName,
        email: device.user.email,
        status: device.user.status,
        category: device.user.category,
      },
    };
  }

  private toAdminDetail(device: DeviceListRow) {
    const row = this.toAdminRow(device);
    return {
      ...row,
      device: {
        manufacturer: device.deviceManufacturer,
        model: device.deviceModel,
        androidOsVersion: device.androidOsVersion,
        sdkLevel: device.sdkLevel,
        name: device.deviceName,
        platform: device.platform,
      },
      application: {
        versionName: device.appVersionName ?? device.appVersion,
        versionCode: device.appVersionCode,
        versionLabel: row.appVersionLabel,
        packageName: device.packageName,
        appLocale: device.appLocale,
        appLanguage: device.appLanguage,
        themeMode: device.themeMode,
        firstSeenAt: device.createdAt,
        lastSeenAt: device.lastSeenAt,
      },
      profile: {
        roleId: device.user.category,
        displayName: device.user.displayName,
      },
      security: {
        status: row.integrity.status,
        reasons: row.integrity.reasons,
        clientReportedAccessState: device.clientReportedAccessState,
        clientReportedAccessAt: device.clientReportedAccessAt,
        serverEffectiveStatus: row.serverEffectiveStatus,
        note: 'Клиентское состояние не является доказательством личности и не управляет доступом.',
      },
    };
  }
}
