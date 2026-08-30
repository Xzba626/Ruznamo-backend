import { Controller, Get, HttpCode } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  HealthCheckResult,
  PrismaHealthIndicator,
} from '@nestjs/terminus';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('health')
@SkipThrottle()
@Controller()
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaHealth: PrismaHealthIndicator,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'API root — service info and links' })
  root(): {
    success: true;
    data: {
      service: string;
      version: string;
      links: Record<string, string>;
    };
  } {
    return {
      success: true,
      data: {
        service: 'Ruznamo API',
        version: '1.0.0',
        links: {
          health: '/health',
          readiness: '/health/ready',
          appConfig: '/api/v1/app/config',
          docs: '/api/docs',
        },
      },
    };
  }

  @Get('favicon.ico')
  @HttpCode(204)
  @ApiOperation({ summary: 'Browser favicon (no content)' })
  favicon(): void {
    return;
  }

  @Get('health')
  @ApiOperation({ summary: 'Liveness probe' })
  liveness(): { status: string; timestamp: string } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('health/ready')
  @ApiOperation({ summary: 'Readiness probe (includes database)' })
  @HealthCheck()
  readiness(): Promise<HealthCheckResult> {
    return this.health.check([() => this.prismaHealth.pingCheck('database', this.prisma)]);
  }
}
