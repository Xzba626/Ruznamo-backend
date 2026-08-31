import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentAdmin } from '../decorators/current-admin.decorator';
import { RequirePermissions } from '../decorators/require-permissions.decorator';
import { AdminJwtPayload } from '../auth/admin-jwt.payload';
import { AdminJwtAuthGuard } from '../guards/admin-jwt-auth.guard';
import { AdminPermissionsGuard } from '../guards/admin-permissions.guard';
import { AdminTelegramService } from './admin-telegram.service';

@ApiTags('admin-telegram')
@ApiBearerAuth()
@UseGuards(AdminJwtAuthGuard, AdminPermissionsGuard)
@Controller('api/v1/admin/telegram')
export class AdminTelegramController {
  constructor(private readonly adminTelegramService: AdminTelegramService) {}

  @Post('connect')
  @RequirePermissions('dashboard:read')
  @ApiOperation({ summary: 'Create one-time Telegram link code (OWNER flow)' })
  async connect(@CurrentAdmin() admin: AdminJwtPayload) {
    return this.adminTelegramService.createConnectToken(admin.sub);
  }

  @Get('status')
  @RequirePermissions('dashboard:read')
  @ApiOperation({ summary: 'Telegram connection status for current admin' })
  async status(@CurrentAdmin() admin: AdminJwtPayload) {
    return this.adminTelegramService.getStatus(admin.sub);
  }
}
