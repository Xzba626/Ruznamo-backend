import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { MobileJwtAuthGuard } from './guards/mobile-jwt-auth.guard';
import { MobileJwtPayload } from './mobile-jwt.payload';
import { AuthService } from './auth.service';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { MobileLogoutDto, MobileRefreshDto } from './dto/mobile-refresh.dto';

@ApiTags('mobile-auth')
@UseGuards(MobileJwtAuthGuard)
@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('device/register')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Device-first registration / session restore' })
  registerDevice(@Body() body: RegisterDeviceDto, @Req() req: Request) {
    return this.authService.registerDevice(body, this.meta(req));
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Rotate mobile refresh token' })
  async refresh(@Body() body: MobileRefreshDto, @Req() req: Request) {
    const tokens = await this.authService.refresh(body.refreshToken, this.meta(req));
    return { tokens };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Logout current mobile session' })
  async logout(
    @CurrentUser() user: MobileJwtPayload,
    @Body() body: MobileLogoutDto,
    @Req() req: Request,
  ): Promise<void> {
    await this.authService.logout(user.sub, body.refreshToken, this.meta(req));
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Logout all mobile sessions' })
  async logoutAll(@CurrentUser() user: MobileJwtPayload, @Req() req: Request): Promise<void> {
    await this.authService.logoutAll(user.sub, this.meta(req));
  }

  private meta(req: Request): { ipAddress?: string; userAgent?: string } {
    return { ipAddress: req.ip, userAgent: req.headers['user-agent'] };
  }
}
