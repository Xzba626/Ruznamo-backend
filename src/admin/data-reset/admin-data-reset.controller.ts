import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DataResetScope } from '@prisma/client';
import { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { RequirePermissions } from '../decorators/require-permissions.decorator';
import { CurrentAdmin } from '../decorators/current-admin.decorator';
import { AdminJwtAuthGuard } from '../guards/admin-jwt-auth.guard';
import { AdminPermissionsGuard } from '../guards/admin-permissions.guard';
import { AdminJwtPayload } from '../auth/admin-jwt.payload';
import { AdminDataResetService } from './admin-data-reset.service';
import {
  ChangeResetPasswordDto,
  DataResetDryRunDto,
  ExecuteDataResetDto,
  SetResetPasswordDto,
} from './dto/data-reset.dto';

@ApiTags('admin-data-reset')
@ApiBearerAuth()
@UseGuards(AdminJwtAuthGuard, AdminPermissionsGuard)
@Controller('api/v1/admin/system/data-reset')
export class AdminDataResetController {
  constructor(private readonly dataResetService: AdminDataResetService) {}

  @Get('password-status')
  // Same capability gate as dry-run/execute: avoid requiring system:read while JWT has system:reset
  // (observed production: global page error while dry-run still succeeded).
  @RequirePermissions('system:reset')
  @ApiOperation({ summary: 'Data reset password configuration status' })
  passwordStatus() {
    return this.dataResetService.getResetPasswordStatus();
  }

  @Post('password/initialize')
  @RequirePermissions('system:reset')
  @ApiOperation({ summary: 'Set initial data reset password' })
  initializePassword(
    @CurrentAdmin() admin: AdminJwtPayload,
    @Body() body: SetResetPasswordDto,
  ) {
    return this.dataResetService.setInitialResetPassword(
      admin.sub,
      body.newPassword,
      body.confirmPassword,
    );
  }

  @Post('password/change')
  @RequirePermissions('system:reset')
  @ApiOperation({ summary: 'Change data reset password' })
  changePassword(@CurrentAdmin() admin: AdminJwtPayload, @Body() body: ChangeResetPasswordDto) {
    return this.dataResetService.changeResetPassword(
      admin.sub,
      body.currentPassword,
      body.newPassword,
      body.confirmPassword,
    );
  }

  @Post('dry-run')
  @RequirePermissions('system:reset')
  @ApiOperation({ summary: 'Preview data reset impact counts' })
  dryRun(@CurrentAdmin() admin: AdminJwtPayload, @Body() body: DataResetDryRunDto) {
    return this.dataResetService.dryRun(body.scope as DataResetScope, admin.sub);
  }

  @Post('execute')
  @RequirePermissions('system:reset')
  @Throttle({ default: { limit: 3, ttl: 600000 } })
  @ApiOperation({ summary: 'Execute destructive data reset' })
  execute(
    @CurrentAdmin() admin: AdminJwtPayload,
    @Body() body: ExecuteDataResetDto,
    @Req() req: Request,
  ) {
    return this.dataResetService.execute({
      adminId: admin.sub,
      scope: body.scope as DataResetScope,
      resetPassword: body.resetPassword,
      confirmationPhrase: body.confirmationPhrase,
      previewId: body.previewId,
      ipAddress: req.ip,
    });
  }
}
