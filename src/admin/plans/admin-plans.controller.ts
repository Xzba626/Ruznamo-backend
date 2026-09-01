import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentAdmin } from '../decorators/current-admin.decorator';
import { RequirePermissions } from '../decorators/require-permissions.decorator';
import { AdminJwtAuthGuard } from '../guards/admin-jwt-auth.guard';
import { AdminPermissionsGuard } from '../guards/admin-permissions.guard';
import { AdminJwtPayload } from '../auth/admin-jwt.payload';
import { AdminPlansService } from './admin-plans.service';
import { UpdateAdminPlanDto } from './dto/update-admin-plan.dto';

@ApiTags('admin-plans')
@ApiBearerAuth()
@UseGuards(AdminJwtAuthGuard, AdminPermissionsGuard)
@Controller('api/v1/admin/plans')
export class AdminPlansController {
  constructor(private readonly plansService: AdminPlansService) {}

  @Get()
  @RequirePermissions('plans:read')
  @ApiOperation({ summary: 'List subscription plans for admin management' })
  list() {
    return this.plansService.listPlans();
  }

  @Patch(':code')
  @RequirePermissions('plans:update')
  @ApiOperation({ summary: 'Update plan availability or prices' })
  update(
    @CurrentAdmin() admin: AdminJwtPayload,
    @Param('code') code: string,
    @Body() body: UpdateAdminPlanDto,
  ) {
    return this.plansService.updatePlan(admin.sub, code, body);
  }
}
