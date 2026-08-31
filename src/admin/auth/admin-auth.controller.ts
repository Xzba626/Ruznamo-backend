import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { Public } from '../decorators/public.decorator';
import { CurrentAdmin } from '../decorators/current-admin.decorator';
import { AdminJwtPayload } from './admin-jwt.payload';
import { AdminAuthService } from './admin-auth.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { AdminLogoutDto, AdminRefreshDto } from './dto/admin-refresh.dto';
import { AdminChangePasswordDto } from './dto/admin-change-password.dto';
import { AdminJwtAuthGuard } from '../guards/admin-jwt-auth.guard';

@ApiTags('admin-auth')
@UseGuards(AdminJwtAuthGuard)
@Controller('api/v1/admin/auth')
export class AdminAuthController {
  constructor(private readonly adminAuthService: AdminAuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Admin login (no public registration)' })
  async login(@Body() body: AdminLoginDto, @Req() req: Request) {
    return this.adminAuthService.login(body.username, body.password, this.meta(req));
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Rotate admin refresh token' })
  async refresh(@Body() body: AdminRefreshDto, @Req() req: Request) {
    const tokens = await this.adminAuthService.refresh(body.refreshToken, this.meta(req));
    return { tokens };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout admin session' })
  async logout(
    @CurrentAdmin() admin: AdminJwtPayload,
    @Body() body: AdminLogoutDto,
    @Req() req: Request,
  ): Promise<void> {
    await this.adminAuthService.logout(admin.sub, body.refreshToken, this.meta(req));
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Current admin profile' })
  async me(@CurrentAdmin() admin: AdminJwtPayload) {
    return this.adminAuthService.getProfile(admin.sub);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change admin password and revoke sessions' })
  async changePassword(
    @CurrentAdmin() admin: AdminJwtPayload,
    @Body() body: AdminChangePasswordDto,
    @Req() req: Request,
  ): Promise<void> {
    await this.adminAuthService.changePassword(
      admin.sub,
      body.currentPassword,
      body.newPassword,
      this.meta(req),
    );
  }

  private meta(req: Request): { ipAddress?: string; userAgent?: string } {
    return {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    };
  }
}
