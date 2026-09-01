import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../decorators/require-permissions.decorator';
import { AdminJwtAuthGuard } from '../guards/admin-jwt-auth.guard';
import { AdminPermissionsGuard } from '../guards/admin-permissions.guard';
import { AdminAnalyticsService } from './admin-analytics.service';

@ApiTags('admin-analytics')
@ApiBearerAuth()
@UseGuards(AdminJwtAuthGuard, AdminPermissionsGuard)
@Controller('api/v1/admin/analytics')
export class AdminAnalyticsController {
  constructor(private readonly analyticsService: AdminAnalyticsService) {}

  @Get('overview')
  @RequirePermissions('dashboard:read')
  @ApiOperation({ summary: 'Aggregate product analytics (privacy-safe)' })
  overview() {
    return this.analyticsService.getOverview();
  }
}
