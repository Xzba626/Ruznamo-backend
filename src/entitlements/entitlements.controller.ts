import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { MobileJwtAuthGuard } from '../auth/guards/mobile-jwt-auth.guard';
import { MobileJwtPayload } from '../auth/mobile-jwt.payload';
import { DeviceTelemetryQueryDto } from '../devices/dto/device-telemetry-query.dto';
import { DeviceTelemetryService } from '../devices/device-telemetry.service';
import { EntitlementService } from './entitlement.service';

@ApiTags('mobile-entitlements')
@ApiBearerAuth()
@UseGuards(MobileJwtAuthGuard)
@Controller('api/v1/me')
export class EntitlementsController {
  constructor(
    private readonly entitlementService: EntitlementService,
    private readonly deviceTelemetry: DeviceTelemetryService,
  ) {}

  @Get('entitlements')
  @ApiOperation({ summary: 'Get current user access entitlements' })
  async getEntitlements(
    @CurrentUser() user: MobileJwtPayload,
    @Query() query: DeviceTelemetryQueryDto,
    @Req() req: Request,
  ) {
    if (
      query.appVersion ||
      query.appVersionName ||
      query.appVersionCode ||
      query.appLocale ||
      query.deviceManufacturer ||
      query.deviceModel ||
      query.androidOsVersion
    ) {
      await this.deviceTelemetry.syncByInstallationId(user.installationId, query, req.ip);
    } else {
      await this.deviceTelemetry.touchLastSeen(user.deviceId, req.ip);
    }

    const snapshot = await this.entitlementService.getSnapshot(user.sub, user.installationId);

    return {
      access: snapshot.access,
      source: snapshot.source,
      effectiveStatus: snapshot.effectiveStatus,
      plan: snapshot.plan,
      trial: snapshot.trial,
      license: snapshot.license,
      devices: {
        active: snapshot.devices.activeCount,
        max: snapshot.devices.max,
        currentInstallationActive: snapshot.devices.currentInstallationActive,
      },
      features: snapshot.features,
      evaluatedAt: snapshot.evaluatedAt,
    };
  }
}
