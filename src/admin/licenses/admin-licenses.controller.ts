import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { CurrentAdmin } from '../decorators/current-admin.decorator';
import { RequirePermissions } from '../decorators/require-permissions.decorator';
import { AdminJwtAuthGuard } from '../guards/admin-jwt-auth.guard';
import { AdminPermissionsGuard } from '../guards/admin-permissions.guard';
import { AdminJwtPayload } from '../auth/admin-jwt.payload';
import { AdminLicensesService } from './admin-licenses.service';
import { CreateManualLicenseDto } from './dto/create-manual-license.dto';
import { PaginationQueryDto } from '../common/dto/pagination.dto';

class RevokeLicenseDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

@ApiTags('admin-licenses')
@ApiBearerAuth()
@UseGuards(AdminJwtAuthGuard, AdminPermissionsGuard)
@Controller('api/v1/admin/licenses')
export class AdminLicensesController {
  constructor(private readonly licensesService: AdminLicensesService) {}

  @Get()
  @RequirePermissions('licenses:read')
  list(@Query() query: PaginationQueryDto) {
    return this.licensesService.list(query);
  }

  @Get(':id')
  @RequirePermissions('licenses:read')
  getById(@Param('id') id: string) {
    return this.licensesService.getById(id);
  }

  @Post()
  @RequirePermissions('licenses:create')
  @ApiOperation({ summary: 'Create manual license (no payment order)' })
  create(@CurrentAdmin() admin: AdminJwtPayload, @Body() body: CreateManualLicenseDto) {
    return this.licensesService.createManual(admin.sub, body);
  }

  @Patch(':id/revoke')
  @RequirePermissions('licenses:revoke')
  revoke(
    @Param('id') id: string,
    @CurrentAdmin() admin: AdminJwtPayload,
    @Body() body: RevokeLicenseDto,
  ) {
    return this.licensesService.revoke(id, admin.sub, body.reason);
  }
}
