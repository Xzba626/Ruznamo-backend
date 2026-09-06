import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../decorators/require-permissions.decorator';
import { AdminJwtAuthGuard } from '../guards/admin-jwt-auth.guard';
import { AdminPermissionsGuard } from '../guards/admin-permissions.guard';
import { AdminDevicesService } from './admin-devices.service';
import { AdminDevicesQueryDto } from './dto/admin-devices-query.dto';

@ApiTags('admin-devices')
@ApiBearerAuth()
@UseGuards(AdminJwtAuthGuard, AdminPermissionsGuard)
@Controller('api/v1/admin/devices')
export class AdminDevicesController {
  constructor(private readonly devicesService: AdminDevicesService) {}

  @Get('stats')
  @RequirePermissions('devices:read')
  @ApiOperation({ summary: 'Installation aggregate statistics (by installationId)' })
  stats() {
    return this.devicesService.stats();
  }

  @Get()
  @RequirePermissions('devices:read')
  @ApiOperation({ summary: 'List device installations with license/trial/integrity' })
  list(@Query() query: AdminDevicesQueryDto) {
    return this.devicesService.list(query);
  }

  @Get(':id')
  @RequirePermissions('devices:read')
  @ApiOperation({ summary: 'Installation detail for recovery and integrity review' })
  getById(@Param('id') id: string) {
    return this.devicesService.getById(id);
  }
}
