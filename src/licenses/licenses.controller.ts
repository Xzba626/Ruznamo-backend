import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { MobileJwtAuthGuard } from '../auth/guards/mobile-jwt-auth.guard';
import { MobileJwtPayload } from '../auth/mobile-jwt.payload';
import { ActivateLicenseDto } from './dto/activate-license.dto';
import { CreateDeviceReplacementChallengeDto } from './dto/create-device-replacement-challenge.dto';
import { CreateTelegramLinkChallengeDto } from './dto/create-telegram-link-challenge.dto';
import {
  ActivateViaTelegramDto,
  ReplaceDeviceViaGrantDto,
  RevealLicenseKeyDto,
} from '../auth/dto/telegram-auth.dto';
import { DeviceReplacementService } from './device-replacement.service';
import { LicenseRecoveryService } from './license-recovery.service';
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
    private readonly licenseRecoveryService: LicenseRecoveryService,
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

  @Get('recovery/licenses')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'List licenses controlled by verified Telegram holder (masked keys)' })
  listRecoveryLicenses(
    @CurrentUser() user: MobileJwtPayload,
    @Query('recoveryGrantId') recoveryGrantId: string,
  ) {
    return this.licenseRecoveryService.listHolderLicenses(recoveryGrantId, user);
  }

  @Post('recovery/reveal-key')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Reveal full license key after fresh Telegram verification' })
  revealRecoveryKey(@CurrentUser() user: MobileJwtPayload, @Body() body: RevealLicenseKeyDto) {
    return this.licenseRecoveryService.revealLicenseKey(body.recoveryGrantId, body.licenseId, user);
  }

  @Post('recovery/activate')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Activate selected license on current device via Telegram auth (no key)' })
  activateViaTelegram(
    @CurrentUser() user: MobileJwtPayload,
    @Body() body: ActivateViaTelegramDto,
    @Req() req: Request,
  ) {
    return this.licenseRecoveryService.activateViaTelegram(
      body.recoveryGrantId,
      body.licenseId,
      user,
      this.meta(req),
    );
  }

  @Post('recovery/replace-device')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Replace an active device after Telegram verification' })
  replaceDeviceViaGrant(
    @CurrentUser() user: MobileJwtPayload,
    @Body() body: ReplaceDeviceViaGrantDto,
    @Req() req: Request,
  ) {
    return this.licenseRecoveryService.replaceDeviceViaGrant(
      body.recoveryGrantId,
      body.licenseId,
      body.oldDeviceId,
      user,
      this.meta(req),
    );
  }

  private meta(req: Request): { ipAddress?: string; userAgent?: string } {
    return { ipAddress: req.ip, userAgent: req.headers['user-agent'] };
  }
}
