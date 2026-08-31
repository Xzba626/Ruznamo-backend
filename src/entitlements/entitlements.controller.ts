import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { MobileJwtAuthGuard } from '../auth/guards/mobile-jwt-auth.guard';
import { MobileJwtPayload } from '../auth/mobile-jwt.payload';
import { EntitlementService } from './entitlement.service';

@ApiTags('mobile-entitlements')
@ApiBearerAuth()
@UseGuards(MobileJwtAuthGuard)
@Controller('api/v1/me')
export class EntitlementsController {
  constructor(private readonly entitlementService: EntitlementService) {}

  @Get('entitlements')
  @ApiOperation({ summary: 'Get current user access entitlements' })
  async getEntitlements(@CurrentUser() user: MobileJwtPayload) {
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
