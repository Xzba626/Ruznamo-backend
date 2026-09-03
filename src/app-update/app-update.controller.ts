import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Platform } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/decorators/public.decorator';
import { AppUpdateService } from './app-update.service';
import { AppUpdateQueryDto } from './dto/app-update-query.dto';

@ApiTags('app-update')
@Controller('api/v1/app')
export class AppUpdateController {
  constructor(private readonly appUpdateService: AppUpdateService) {}

  @Public()
  @Get('update')
  @ApiOperation({ summary: 'Check for published Android app update (metadata only)' })
  checkUpdate(@Query() query: AppUpdateQueryDto) {
    return this.appUpdateService.checkUpdate({
      platform: query.platform ?? Platform.ANDROID,
      versionCode: query.versionCode,
      locale: query.locale,
    });
  }

  @Public()
  @Post('releases/:releaseId/download')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Issue a fresh short-lived signed GET URL for a downloadable release' })
  authorizeDownload(@Param('releaseId') releaseId: string) {
    return this.appUpdateService.authorizeDownload(releaseId);
  }
}
