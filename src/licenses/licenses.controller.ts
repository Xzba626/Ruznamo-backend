import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { MobileJwtAuthGuard } from '../auth/guards/mobile-jwt-auth.guard';
import { MobileJwtPayload } from '../auth/mobile-jwt.payload';
import { ActivateLicenseDto } from './dto/activate-license.dto';
import { CreateDeviceReplacementChallengeDto } from './dto/create-device-replacement-challenge.dto';
import { CreateTelegramLinkChallengeDto } from './dto/create-telegram-link-challenge.dto';
import { DeviceReplacementService } from './device-replacement.service';
import { LicensesService } from './licenses.service';
import { TelegramLicenseLinkService } from './telegram-license-link.service';

@ApiTags('mobile-licenses')
@ApiBearerAuth()
@UseGuards(MobileJwtAuthGuard)
@Controller('api/v1/licenses')
export class LicensesController {
  constructor(
    private readonly licensesService: LicensesService,
    private readonly telegramLicenseLinkService: TelegramLicenseLinkService,
    private readonly deviceReplacementService: DeviceReplacementService,
  ) {}

  @Post('activate')
  @ApiOperation({ summary: 'Activate a license key for the current user and device' })
  activate(
    @CurrentUser() user: MobileJwtPayload,
    @Body() body: ActivateLicenseDto,
    @Req() req: Request,
  ) {
    return this.licensesService.activate(user, body.licenseKey, this.meta(req));
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current user license summary with Telegram control state' })
  me(@CurrentUser() user: MobileJwtPayload) {
    return this.licensesService.getMyLicenses(user.sub, user.deviceId);
  }

  @Post('telegram-link/challenge')
  @ApiOperation({ summary: 'Create secure Telegram link challenge for an active license on this device' })
  createTelegramLinkChallenge(
    @CurrentUser() user: MobileJwtPayload,
    @Body() body: CreateTelegramLinkChallengeDto,
  ) {
    return this.telegramLicenseLinkService.createChallenge(user, body.licenseId);
  }

  @Post('device-replacement/challenge')
  @ApiOperation({ summary: 'Create device replacement challenge when activation limit is reached' })
  createDeviceReplacementChallenge(
    @CurrentUser() user: MobileJwtPayload,
    @Body() body: CreateDeviceReplacementChallengeDto,
  ) {
    return this.deviceReplacementService.createChallenge(user, body.licenseKey);
  }

  private meta(req: Request): { ipAddress?: string; userAgent?: string } {
    return { ipAddress: req.ip, userAgent: req.headers['user-agent'] };
  }
}
