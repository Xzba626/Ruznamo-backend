import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HealthCheckService, PrismaHealthIndicator } from '@nestjs/terminus';
import { readFileSync } from 'fs';
import { join } from 'path';
import { maskSecret, normalizeTelegramBotUsername } from '../../config/telegram-env.util';
import { PrismaService } from '../../prisma/prisma.service';

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
        by: ['appVersion'],
        where: { revokedAt: null },
        _count: { _all: true },
      }),
      this.prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::bigint AS count FROM "_prisma_migrations"
      `.catch(() => [{ count: BigInt(0) }]),
    ]);

    const deviceVersions = deviceVersionRows
      .map((row) => ({
        appVersion: row.appVersion ?? 'unknown',
        count: row._count._all,
      }))
      .sort((a, b) => b.count - a.count);

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
        note: 'Версии на устройствах — из telemetry DeviceInstallation.appVersion',
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
        webhook: { status: 'not_configured' as ServiceStatus, lastError: null },
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
    pendingUpdateCount?: number;
    url?: string | null;
  }> {
    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
      if (!response.ok) {
        return { status: 'error', lastError: `HTTP ${response.status}` };
      }

      const json = (await response.json()) as {
        ok: boolean;
        result?: {
          url?: string;
          last_error_message?: string;
          pending_update_count?: number;
        };
      };

      if (!json.ok || !json.result) {
        return { status: 'error', lastError: 'telegram_api_error' };
      }

      const lastError = json.result.last_error_message ?? null;
      return {
        status: lastError ? 'warning' : 'healthy',
        lastError,
        pendingUpdateCount: json.result.pending_update_count,
        url: json.result.url ?? null,
      };
    } catch {
      return { status: 'error', lastError: 'probe_failed' };
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
