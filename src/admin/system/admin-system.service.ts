import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HealthCheckService, PrismaHealthIndicator } from '@nestjs/terminus';
import { readFileSync } from 'fs';
import { join } from 'path';
import { maskSecret, normalizeTelegramBotUsername } from '../../config/telegram-env.util';
import { formatAppVersionLabel } from '../../devices/device-metadata.util';
import { customerDeviceWhere } from '../../devices/probe-device-filter.util';
import { PrismaService } from '../../prisma/prisma.service';
import { evaluateTelegramWebhookHealth } from './telegram-webhook-health';

type ServiceStatus = 'healthy' | 'warning' | 'error' | 'not_configured' | 'info';

@Injectable()
export class AdminSystemService {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaHealth: PrismaHealthIndicator,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async getStatus() {
    const checkedAt = new Date();
    let databaseReachable = false;
    let readiness: ServiceStatus = 'error';

    try {
      const result = await this.health.check([
        () => this.prismaHealth.pingCheck('database', this.prisma),
      ]);
      databaseReachable = result.status === 'ok';
      readiness = result.status === 'ok' ? 'healthy' : 'error';
    } catch {
      databaseReachable = false;
      readiness = 'error';
    }

    const [appVersion, deviceVersionRows, migrationCount] = await Promise.all([
      this.prisma.appVersion.findFirst({
        where: { isActive: true },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.deviceInstallation.groupBy({
        by: ['appVersionCode', 'appVersionName', 'appVersion'],
        where: customerDeviceWhere(),
        _count: { _all: true },
      }),
      this.prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::bigint AS count FROM "_prisma_migrations"
      `.catch(() => [{ count: BigInt(0) }]),
    ]);

    const versionBuckets = new Map<string, { appVersion: string; count: number }>();
    for (const row of deviceVersionRows) {
      const label =
        formatAppVersionLabel({
          appVersionName: row.appVersionName,
          appVersionCode: row.appVersionCode,
          appVersion: row.appVersion,
        }) ?? 'unknown';
      const existing = versionBuckets.get(label);
      if (existing) {
        existing.count += row._count._all;
      } else {
        versionBuckets.set(label, { appVersion: label, count: row._count._all });
      }
    }
    const deviceVersions = [...versionBuckets.values()].sort((a, b) => b.count - a.count);

    const telegram = await this.getTelegramRuntimeSummary();

    return {
      checkedAt: checkedAt.toISOString(),
      backend: {
        status: 'healthy' as ServiceStatus,
        version: this.readBackendVersion(),
        buildId: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GIT_COMMIT_SHA ?? null,
        environment: this.configService.get<string>('app.nodeEnv', 'development'),
      },
      database: {
        status: databaseReachable ? ('healthy' as ServiceStatus) : ('error' as ServiceStatus),
        reachable: databaseReachable,
        migrationCount: Number(migrationCount[0]?.count ?? 0),
        legacyState: databaseReachable ? 'up' : 'down',
      },
      readiness: {
        status: readiness,
        legacyState: databaseReachable ? 'ready' : 'not_ready',
      },
      android: {
        status: appVersion ? ('info' as ServiceStatus) : ('warning' as ServiceStatus),
        configuredLatestVersion: appVersion?.latestVersion ?? null,
        minimumSupportedVersion: appVersion?.minimumSupportedVersion ?? null,
        forceUpdate: appVersion?.forceUpdate ?? false,
        note: 'Версии на устройствах — telemetry DeviceInstallation (appVersionName + appVersionCode)',
        deviceVersionDistribution: deviceVersions,
      },
      telegram,
      adminPanel: {
        status: 'info' as ServiceStatus,
        note: 'Версия фронтенда задаётся при сборке admin-panel',
      },
    };
  }

  getTelegramRuntimeStatus() {
    const token = maskSecret(this.configService.get<string>('telegram.botToken'));
    const webhookSecret = maskSecret(this.configService.get<string>('telegram.webhookSecret'));
    const rawUsername = this.configService.get<string>('telegram.botUsername', '');
    const botUsername = normalizeTelegramBotUsername(rawUsername);
    const adminIds = this.configService.get<string[]>('telegram.adminTelegramIds', []);

    return {
      enabled: this.configService.get<boolean>('telegram.enabled', false),
      misconfigured: this.configService.get<boolean>('telegram.misconfigured', false),
      botToken: token,
      webhookSecret,
      botUsername,
      botUsernameRawPresent: Boolean(rawUsername?.trim()),
      botUsernameNormalized: botUsername !== null,
      adminTelegramIdsCount: adminIds.length,
      webhookUrl: 'https://ruznamo-backend-o4xk.vercel.app/api/v1/telegram/webhook',
    };
  }

  private async getTelegramRuntimeSummary() {
    const enabled = this.configService.get<boolean>('telegram.enabled', false);
    const misconfigured = this.configService.get<boolean>('telegram.misconfigured', false);
    const rawUsername = this.configService.get<string>('telegram.botUsername', '');
    const botUsername = normalizeTelegramBotUsername(rawUsername);
    const token = this.configService.get<string>('telegram.botToken', '');

    if (!enabled || !token) {
      return {
        status: 'not_configured' as ServiceStatus,
        enabled,
        misconfigured,
        botUsername,
        webhook: { status: 'not_configured' as ServiceStatus, lastError: null, lastErrorAt: null, lastErrorHistorical: false },
      };
    }

    const webhook = await this.probeWebhookHealth(token);

    let status: ServiceStatus = 'healthy';
    if (misconfigured) {
      status = 'warning';
    }
    if (webhook.status === 'error') {
      status = 'error';
    } else if (webhook.status === 'warning' && status === 'healthy') {
      status = 'warning';
    }

    return {
      status,
      enabled,
      misconfigured,
      botUsername,
      webhook,
    };
  }

  private async probeWebhookHealth(token: string): Promise<{
    status: ServiceStatus;
    lastError: string | null;
    lastErrorAt?: string | null;
    lastErrorHistorical?: boolean;
    pendingUpdateCount?: number;
    url?: string | null;
  }> {
    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
      if (!response.ok) {
        return { status: 'error', lastError: `HTTP ${response.status}`, lastErrorAt: null, lastErrorHistorical: false };
      }

      const json = (await response.json()) as {
        ok: boolean;
        result?: {
          url?: string;
          last_error_message?: string;
          last_error_date?: number;
          pending_update_count?: number;
        };
      };

      if (!json.ok || !json.result) {
        return {
          status: 'error',
          lastError: 'telegram_api_error',
          lastErrorAt: null,
          lastErrorHistorical: false,
        };
      }

      return evaluateTelegramWebhookHealth({
        url: json.result.url ?? null,
        lastErrorMessage: json.result.last_error_message ?? null,
        lastErrorDateUnix: json.result.last_error_date ?? null,
        pendingUpdateCount: json.result.pending_update_count ?? 0,
      });
    } catch {
      return {
        status: 'error',
        lastError: 'probe_failed',
        lastErrorAt: null,
        lastErrorHistorical: false,
      };
    }
  }

  private readBackendVersion(): string {
    try {
      const packageJson = JSON.parse(
        readFileSync(join(process.cwd(), 'package.json'), 'utf8'),
      ) as { version?: string };
      return packageJson.version ?? '0.0.0';
    } catch {
      return '0.0.0';
    }
  }
}
