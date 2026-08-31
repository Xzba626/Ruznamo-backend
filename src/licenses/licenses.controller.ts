import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { MobileJwtAuthGuard } from '../auth/guards/mobile-jwt-auth.guard';
import { MobileJwtPayload } from '../auth/mobile-jwt.payload';
import { ActivateLicenseDto } from './dto/activate-license.dto';
import { LicensesService } from './licenses.service';

@ApiTags('mobile-licenses')
@ApiBearerAuth()
@UseGuards(MobileJwtAuthGuard)
@Controller('api/v1/licenses')
export class LicensesController {
  constructor(private readonly licensesService: LicensesService) {}

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
  @ApiOperation({ summary: 'Get current user license summary' })
  me(@CurrentUser() user: MobileJwtPayload) {
    return this.licensesService.getMyLicenses(user.sub);
  }

  private meta(req: Request): { ipAddress?: string; userAgent?: string } {
    return { ipAddress: req.ip, userAgent: req.headers['user-agent'] };
  }
}
