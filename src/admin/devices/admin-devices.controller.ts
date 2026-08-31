import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../decorators/require-permissions.decorator';
import { AdminJwtAuthGuard } from '../guards/admin-jwt-auth.guard';
import { AdminPermissionsGuard } from '../guards/admin-permissions.guard';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { AdminDevicesService } from './admin-devices.service';

@ApiTags('admin-devices')
@ApiBearerAuth()
@UseGuards(AdminJwtAuthGuard, AdminPermissionsGuard)
@Controller('api/v1/admin/devices')
export class AdminDevicesController {
  constructor(private readonly devicesService: AdminDevicesService) {}

  @Get()
  @RequirePermissions('devices:read')
  @ApiOperation({ summary: 'List device installations' })
  list(@Query() query: PaginationQueryDto) {
    return this.devicesService.list(query);
  }
}
