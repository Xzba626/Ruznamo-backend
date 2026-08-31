import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HealthCheckService, PrismaHealthIndicator } from '@nestjs/terminus';
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
}
