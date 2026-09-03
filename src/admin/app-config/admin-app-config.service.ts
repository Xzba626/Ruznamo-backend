import { BadRequestException, Injectable } from '@nestjs/common';
import { AuditActorType, Platform } from '@prisma/client';
import { AuditService } from '../../audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateAdminAppConfigDto } from './dto/update-admin-app-config.dto';

const CONFIG_KEYS = [
  'CONFIG_VERSION',
  'MAINTENANCE_MODE',
  'MAINTENANCE_MESSAGE_TJ',
  'ANNOUNCEMENT_ENABLED',
  'ANNOUNCEMENT_TITLE',
  'ANNOUNCEMENT_MESSAGE',
  'ANNOUNCEMENT_TYPE',
] as const;

@Injectable()
export class AdminAppConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async getAdminConfig() {
    const [configRows, appVersion] = await Promise.all([
      this.prisma.systemConfig.findMany({
        where: { key: { in: [...CONFIG_KEYS] } },
      }),
      this.prisma.appVersion.findFirst({
        where: { platform: Platform.ANDROID, isActive: true },
        orderBy: { updatedAt: 'desc' },
      }),
    ]);

    const config = Object.fromEntries(configRows.map((row) => [row.key, row.value]));

    return {
      configVersion: config.CONFIG_VERSION ?? '1',
      maintenance: {
        enabled: config.MAINTENANCE_MODE === 'true',
        message: config.MAINTENANCE_MESSAGE_TJ ?? '',
      },
      announcement: {
        enabled: config.ANNOUNCEMENT_ENABLED === 'true',
        title: config.ANNOUNCEMENT_TITLE ?? '',
        message: config.ANNOUNCEMENT_MESSAGE ?? '',
        type: config.ANNOUNCEMENT_TYPE ?? 'INFO',
      },
      android: appVersion
        ? {
            latestVersion: appVersion.latestVersion,
            minimumSupportedVersion: appVersion.minimumSupportedVersion,
            updateUrl: appVersion.updateUrl,
            forceUpdate: appVersion.forceUpdate,
            releaseNotes: appVersion.releaseNotes,
            releaseNotesTj: appVersion.releaseNotesTj,
          }
        : null,
    };
  }

  async updateAdminConfig(adminId: string, dto: UpdateAdminAppConfigDto) {
    await this.prisma.$transaction(async (tx) => {
      const upsertConfig = async (key: string, value: string) => {
        await tx.systemConfig.upsert({
          where: { key },
          update: { value },
          create: { key, value },
        });
      };

      if (dto.configVersion !== undefined) {
        await upsertConfig('CONFIG_VERSION', dto.configVersion);
      }
      if (dto.maintenanceEnabled !== undefined) {
        await upsertConfig('MAINTENANCE_MODE', dto.maintenanceEnabled ? 'true' : 'false');
      }
      if (dto.maintenanceMessage !== undefined) {
        await upsertConfig('MAINTENANCE_MESSAGE_TJ', dto.maintenanceMessage);
      }
      if (dto.announcementEnabled !== undefined) {
        await upsertConfig('ANNOUNCEMENT_ENABLED', dto.announcementEnabled ? 'true' : 'false');
      }
      if (dto.announcementTitle !== undefined) {
        await upsertConfig('ANNOUNCEMENT_TITLE', dto.announcementTitle);
      }
      if (dto.announcementMessage !== undefined) {
        await upsertConfig('ANNOUNCEMENT_MESSAGE', dto.announcementMessage);
      }
      if (dto.announcementType !== undefined) {
        await upsertConfig('ANNOUNCEMENT_TYPE', dto.announcementType);
      }

      if (dto.android) {
        const existing = await tx.appVersion.findFirst({
          where: { platform: Platform.ANDROID, isActive: true },
          orderBy: { updatedAt: 'desc' },
        });

        if (existing) {
          await tx.appVersion.update({
            where: { id: existing.id },
            data: {
              latestVersion: dto.android.latestVersion ?? existing.latestVersion,
              minimumSupportedVersion:
                dto.android.minimumSupportedVersion ?? existing.minimumSupportedVersion,
              updateUrl: dto.android.updateUrl ?? existing.updateUrl,
              forceUpdate: dto.android.forceUpdate ?? existing.forceUpdate,
              releaseNotes: dto.android.releaseNotes ?? existing.releaseNotes,
              releaseNotesTj: dto.android.releaseNotesTj ?? existing.releaseNotesTj,
            },
          });
        } else {
          if (!dto.android.latestVersion || !dto.android.minimumSupportedVersion) {
            throw new BadRequestException({
              code: 'APP_VERSION_REQUIRED',
              message: 'latestVersion and minimumSupportedVersion are required when creating AppVersion',
            });
          }
          await tx.appVersion.create({
            data: {
              platform: Platform.ANDROID,
              latestVersion: dto.android.latestVersion,
              minimumSupportedVersion: dto.android.minimumSupportedVersion,
              updateUrl: dto.android.updateUrl,
              forceUpdate: dto.android.forceUpdate ?? false,
              isActive: true,
            },
          });
        }
      }
    });

    await this.auditService.log({
      actorType: AuditActorType.ADMIN,
      actorId: adminId,
      action: 'admin.app_config.update',
      entityType: 'SystemConfig',
      metadata: { fields: Object.keys(dto) },
    });

    return this.getAdminConfig();
  }
}
