import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { RequirePermissions } from '../decorators/require-permissions.decorator';
import { AdminJwtAuthGuard } from '../guards/admin-jwt-auth.guard';
import { AdminPermissionsGuard } from '../guards/admin-permissions.guard';
import { AdminAnalyticsService, SalesPeriod } from './admin-analytics.service';

class SalesQueryDto {
  @IsOptional()
  @IsIn(['today', '7d', '30d', 'month', 'prev_month'])
  period?: SalesPeriod;
}

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

  @Get('sales')
  @RequirePermissions('dashboard:read')
  @ApiOperation({ summary: 'Commercial license sales metrics for selected period' })
  sales(@Query() query: SalesQueryDto) {
    return this.analyticsService.getSales(query.period ?? '30d');
  }
}
