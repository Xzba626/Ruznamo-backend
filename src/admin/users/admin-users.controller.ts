import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../decorators/require-permissions.decorator';
import { AdminJwtAuthGuard } from '../guards/admin-jwt-auth.guard';
import { AdminPermissionsGuard } from '../guards/admin-permissions.guard';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { AdminUsersService } from './admin-users.service';

@ApiTags('admin-users')
@ApiBearerAuth()
@UseGuards(AdminJwtAuthGuard, AdminPermissionsGuard)
@Controller('api/v1/admin/users')
export class AdminUsersController {
  constructor(private readonly usersService: AdminUsersService) {}

  @Get()
  @RequirePermissions('users:read')
  @ApiOperation({ summary: 'List application users' })
  list(@Query() query: PaginationQueryDto) {
    return this.usersService.list(query);
  }

  @Get(':id')
  @RequirePermissions('users:read')
  @ApiOperation({ summary: 'User details' })
  getById(@Param('id') id: string) {
    return this.usersService.getById(id);
  }
}
