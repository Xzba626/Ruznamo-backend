import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Platform } from '@prisma/client';
import { Public } from '../auth/decorators/public.decorator';
import { AppUpdateService } from './app-update.service';
import { AppUpdateQueryDto } from './dto/app-update-query.dto';

@ApiTags('app-update')
@Controller('api/v1/app')
export class AppUpdateController {
  constructor(private readonly appUpdateService: AppUpdateService) {}

  @Public()
  @Get('update')
  @ApiOperation({ summary: 'Check for published Android app update' })
  checkUpdate(@Query() query: AppUpdateQueryDto) {
    return this.appUpdateService.checkUpdate({
      platform: query.platform ?? Platform.ANDROID,
      versionCode: query.versionCode,
      locale: query.locale,
    });
  }
}
