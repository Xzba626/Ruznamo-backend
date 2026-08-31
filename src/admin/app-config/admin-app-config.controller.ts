import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentAdmin } from '../decorators/current-admin.decorator';
import { RequirePermissions } from '../decorators/require-permissions.decorator';
import { AdminJwtAuthGuard } from '../guards/admin-jwt-auth.guard';
import { AdminPermissionsGuard } from '../guards/admin-permissions.guard';
import { AdminJwtPayload } from '../auth/admin-jwt.payload';
import { AdminAppConfigService } from './admin-app-config.service';
import { UpdateAdminAppConfigDto } from './dto/update-admin-app-config.dto';

@ApiTags('admin-app-config')
@ApiBearerAuth()
@UseGuards(AdminJwtAuthGuard, AdminPermissionsGuard)
@Controller('api/v1/admin/app-config')
export class AdminAppConfigController {
  constructor(private readonly adminAppConfigService: AdminAppConfigService) {}

  @Get()
  @RequirePermissions('config:read')
  @ApiOperation({ summary: 'Read application configuration for admin panel' })
  getConfig() {
    return this.adminAppConfigService.getAdminConfig();
  }

  @Patch()
  @RequirePermissions('config:update')
  @ApiOperation({ summary: 'Update application configuration' })
  updateConfig(@CurrentAdmin() admin: AdminJwtPayload, @Body() body: UpdateAdminAppConfigDto) {
    return this.adminAppConfigService.updateAdminConfig(admin.sub, body);
  }
}
