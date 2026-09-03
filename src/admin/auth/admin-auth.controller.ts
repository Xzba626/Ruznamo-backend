import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
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
import { AdminUpdateProfileDto } from './dto/admin-update-profile.dto';
import { AdminRevokeSessionsDto } from './dto/admin-revoke-sessions.dto';
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

  @Patch('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update current admin profile (display name)' })
  async updateMe(
    @CurrentAdmin() admin: AdminJwtPayload,
    @Body() body: AdminUpdateProfileDto,
    @Req() req: Request,
  ) {
    return this.adminAuthService.updateProfile(admin.sub, body, this.meta(req));
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

  @Get('sessions')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List active admin sessions' })
  async sessions(
    @CurrentAdmin() admin: AdminJwtPayload,
    @Req() req: Request,
  ) {
    const refreshToken = typeof req.query.refreshToken === 'string' ? req.query.refreshToken : undefined;
    return this.adminAuthService.listSessions(admin.sub, refreshToken);
  }

  @Post('sessions/revoke-others')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke all admin sessions except current' })
  async revokeOtherSessions(
    @CurrentAdmin() admin: AdminJwtPayload,
    @Body() body: AdminRevokeSessionsDto,
    @Req() req: Request,
  ) {
    const count = await this.adminAuthService.revokeOtherSessions(
      admin.sub,
      body.refreshToken,
      this.meta(req),
    );
    return { revoked: count };
  }

  private meta(req: Request): { ipAddress?: string; userAgent?: string } {
    return {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    };
  }
}
