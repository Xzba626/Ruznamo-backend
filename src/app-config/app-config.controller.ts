import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { AppConfigService } from './app-config.service';
import { AppConfigQueryDto, AppConfigResponseDto } from './dto/app-config.dto';

@ApiTags('app-config')
@SkipThrottle()
@Controller('api/v1/app')
export class AppConfigController {
  constructor(private readonly appConfigService: AppConfigService) {}

  @Get('config')
  @ApiOperation({ summary: 'Public Android application configuration' })
  async getConfig(@Query() query: AppConfigQueryDto): Promise<AppConfigResponseDto> {
    return this.appConfigService.getPublicConfig(query.platform, query.appVersion);
  }
}
