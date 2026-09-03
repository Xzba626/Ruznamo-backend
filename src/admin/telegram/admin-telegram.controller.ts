import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentAdmin } from '../decorators/current-admin.decorator';
import { RequirePermissions } from '../decorators/require-permissions.decorator';
import { AdminJwtPayload } from '../auth/admin-jwt.payload';
import { AdminJwtAuthGuard } from '../guards/admin-jwt-auth.guard';
import { AdminPermissionsGuard } from '../guards/admin-permissions.guard';
import { AdminTelegramService } from './admin-telegram.service';
import { AdminTelegramRebindStartDto } from './dto/admin-telegram-rebind-start.dto';
import { AdminTelegramRebindVerifyDto } from './dto/admin-telegram-rebind-verify.dto';

@ApiTags('admin-telegram')
@ApiBearerAuth()
@UseGuards(AdminJwtAuthGuard, AdminPermissionsGuard)
@Controller('api/v1/admin/telegram')
export class AdminTelegramController {
  constructor(private readonly adminTelegramService: AdminTelegramService) {}

  @Post('connect')
  @RequirePermissions('dashboard:read')
  @ApiOperation({ summary: 'Create one-time Telegram link code (legacy RZ flow)' })
  async connect(@CurrentAdmin() admin: AdminJwtPayload) {
    return this.adminTelegramService.createConnectToken(admin.sub);
  }

  @Post('rebind/start')
  @RequirePermissions('dashboard:read')
  @ApiOperation({ summary: 'Start secure Telegram admin rebind (password + bot OTP)' })
  async rebindStart(
    @CurrentAdmin() admin: AdminJwtPayload,
    @Body() body: AdminTelegramRebindStartDto,
  ) {
    return this.adminTelegramService.startTelegramRebind(admin.sub, body.currentPassword);
  }

  @Post('rebind/verify')
  @RequirePermissions('dashboard:read')
  @ApiOperation({ summary: 'Complete Telegram admin rebind with OTP from bot' })
  async rebindVerify(
    @CurrentAdmin() admin: AdminJwtPayload,
    @Body() body: AdminTelegramRebindVerifyDto,
  ) {
    return this.adminTelegramService.verifyTelegramRebind(admin.sub, body.otp);
  }

  @Get('status')
  @RequirePermissions('dashboard:read')
  @ApiOperation({ summary: 'Telegram connection status for current admin' })
  async status(@CurrentAdmin() admin: AdminJwtPayload) {
    return this.adminTelegramService.getStatus(admin.sub);
  }
}
