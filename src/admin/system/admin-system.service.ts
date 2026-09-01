import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HealthCheckService, PrismaHealthIndicator } from '@nestjs/terminus';
import { maskSecret, normalizeTelegramBotUsername } from '../../config/telegram-env.util';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminSystemService {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaHealth: PrismaHealthIndicator,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async getStatus() {
    let database: 'up' | 'down' = 'down';
    let readiness: 'ready' | 'not_ready' = 'not_ready';

    try {
      const result = await this.health.check([
        () => this.prismaHealth.pingCheck('database', this.prisma),
      ]);
      database = result.status === 'ok' ? 'up' : 'down';
      readiness = result.status === 'ok' ? 'ready' : 'not_ready';
    } catch {
      database = 'down';
      readiness = 'not_ready';
    }

    return {
      api: 'healthy',
      database,
      readiness,
      version: '1.0.0',
      environment: this.configService.get<string>('app.nodeEnv', 'development'),
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
}
