import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { PrivacyPolicyService } from './privacy-policy.service';

class PrivacyQueryDto {
  @IsOptional()
  @IsString()
  @IsIn(['ru', 'tj', 'RU', 'TJ', 'tg', 'TG'])
  lang?: string;
}

@ApiTags('privacy-policy')
@Controller('api/v1/privacy-policy')
export class PrivacyPolicyController {
  constructor(private readonly privacyPolicy: PrivacyPolicyService) {}

  @Get()
  @ApiOperation({ summary: 'Current published privacy policy (RU/TJ by app language)' })
  getPublished(@Query() query: PrivacyQueryDto) {
    return this.privacyPolicy.getPublished(query.lang);
  }
}
