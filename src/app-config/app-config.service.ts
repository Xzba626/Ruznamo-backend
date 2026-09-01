import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Platform } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AppConfigResponseDto } from './dto/app-config.dto';

function compareSemver(a: string, b: string): number {
  const parse = (value: string): number[] =>
    value.split('.').map((part) => parseInt(part.replace(/[^0-9].*$/, ''), 10) || 0);

  const left = parse(a);
  const right = parse(b);
  const length = Math.max(left.length, right.length);

  for (let i = 0; i < length; i += 1) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff !== 0) {
      return diff;
    }
  }

  return 0;
}

@Injectable()
export class AppConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async getPublicConfig(
    platform: Platform = Platform.ANDROID,
    clientAppVersion?: string,
  ): Promise<AppConfigResponseDto> {
    const [appVersion, maintenanceMode, maintenanceMessage, configVersionRow, announcementKeys] =
      await Promise.all([
      this.prisma.appVersion.findFirst({
        where: { platform, isActive: true },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.systemConfig.findUnique({ where: { key: 'MAINTENANCE_MODE' } }),
      this.prisma.systemConfig.findUnique({ where: { key: 'MAINTENANCE_MESSAGE_TJ' } }),
      this.prisma.systemConfig.findUnique({ where: { key: 'CONFIG_VERSION' } }),
      this.prisma.systemConfig.findMany({
        where: {
          key: {
            in: [
              'ANNOUNCEMENT_ENABLED',
              'ANNOUNCEMENT_TITLE',
              'ANNOUNCEMENT_MESSAGE',
              'ANNOUNCEMENT_TYPE',
            ],
          },
        },
      }),
    ]);

    const announcementMap = Object.fromEntries(announcementKeys.map((row) => [row.key, row.value]));
    const announcementEnabled = announcementMap.ANNOUNCEMENT_ENABLED === 'true';

    const maintenanceEnabled = maintenanceMode?.value === 'true';
    const latestVersion = appVersion?.latestVersion ?? '1.0.0';
    const minimumSupportedVersion = appVersion?.minimumSupportedVersion ?? '1.0.0';
    const forceUpdate = appVersion?.forceUpdate ?? false;

    let updateRequired = forceUpdate;
    let updateRecommended = false;

    if (clientAppVersion) {
      if (compareSemver(clientAppVersion, minimumSupportedVersion) < 0) {
        updateRequired = true;
      }
      if (compareSemver(clientAppVersion, latestVersion) < 0) {
        updateRecommended = true;
      }
    }

    const telegramBotUsername = this.normalizeBotUsername(
      this.configService.get<string>('telegram.botUsername'),
    );

    return {
      configVersion: configVersionRow?.value ?? '1',
      maintenance: {
        enabled: maintenanceEnabled,
        message: maintenanceEnabled ? (maintenanceMessage?.value ?? null) : null,
      },
      android: {
        latestVersion,
        minimumSupportedVersion,
        updateUrl: appVersion?.updateUrl ?? process.env.ANDROID_UPDATE_URL ?? null,
        forceUpdate,
        updateRequired,
        updateRecommended,
        releaseNotes: appVersion?.releaseNotesTj ?? appVersion?.releaseNotes ?? null,
      },
      announcement: announcementEnabled
        ? {
            enabled: true,
            title: announcementMap.ANNOUNCEMENT_TITLE ?? null,
            message: announcementMap.ANNOUNCEMENT_MESSAGE ?? null,
            type: announcementMap.ANNOUNCEMENT_TYPE ?? 'INFO',
          }
        : {
            enabled: false,
            title: null,
            message: null,
            type: null,
          },
      telegramBotUsername,
      serverTime: new Date().toISOString(),
    };
  }

  private normalizeBotUsername(raw: string | undefined): string | null {
    const trimmed = (raw ?? '').trim().replace(/^@+/, '');
    return trimmed.length > 0 ? trimmed : null;
  }
}
