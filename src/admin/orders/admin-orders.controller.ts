import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { CurrentAdmin } from '../decorators/current-admin.decorator';
import { RequirePermissions } from '../decorators/require-permissions.decorator';
import { AdminJwtAuthGuard } from '../guards/admin-jwt-auth.guard';
import { AdminPermissionsGuard } from '../guards/admin-permissions.guard';
import { AdminJwtPayload } from '../auth/admin-jwt.payload';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { AdminOrdersService } from './admin-orders.service';

class RejectOrderDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

@ApiTags('admin-orders')
@ApiBearerAuth()
@UseGuards(AdminJwtAuthGuard, AdminPermissionsGuard)
@Controller('api/v1/admin/orders')
export class AdminOrdersController {
  constructor(private readonly ordersService: AdminOrdersService) {}

  @Get()
  @RequirePermissions('orders:read')
  @ApiOperation({ summary: 'List payment orders' })
  list(@Query() query: PaginationQueryDto) {
    return this.ordersService.list(query);
  }

  @Get(':id')
  @RequirePermissions('orders:read')
  @ApiOperation({ summary: 'Get order by id' })
  getById(@Param('id') id: string) {
    return this.ordersService.getById(id);
  }

  @Patch(':id/approve')
  @RequirePermissions('orders:approve')
  @ApiOperation({ summary: 'Approve payment order' })
  approve(@Param('id') id: string, @CurrentAdmin() admin: AdminJwtPayload) {
    return this.ordersService.approve(id, admin.sub);
  }

  @Patch(':id/reject')
  @RequirePermissions('orders:reject')
  @ApiOperation({ summary: 'Reject payment order' })
  reject(
    @Param('id') id: string,
    @CurrentAdmin() admin: AdminJwtPayload,
    @Body() body: RejectOrderDto,
  ) {
    return this.ordersService.reject(id, admin.sub, body.reason);
  }
}
