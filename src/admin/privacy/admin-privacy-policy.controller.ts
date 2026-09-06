import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { CurrentAdmin } from '../decorators/current-admin.decorator';
import { RequirePermissions } from '../decorators/require-permissions.decorator';
import { AdminJwtAuthGuard } from '../guards/admin-jwt-auth.guard';
import { AdminPermissionsGuard } from '../guards/admin-permissions.guard';
import { AdminJwtPayload } from '../auth/admin-jwt.payload';
import { PrivacyPolicyService } from '../../privacy/privacy-policy.service';

class SavePrivacyDraftDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100_000)
  contentRu?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100_000)
  contentTg?: string;
}

@ApiTags('admin-privacy-policy')
@ApiBearerAuth()
@UseGuards(AdminJwtAuthGuard, AdminPermissionsGuard)
@Controller('api/v1/admin/privacy-policy')
export class AdminPrivacyPolicyController {
  constructor(private readonly privacyPolicy: PrivacyPolicyService) {}

  @Get()
  @RequirePermissions('content:read')
  @ApiOperation({ summary: 'Privacy policy overview (current, draft, history)' })
  overview() {
    return this.privacyPolicy.getAdminOverview();
  }

  @Get(':id')
  @RequirePermissions('content:read')
  @ApiOperation({ summary: 'Privacy policy revision detail / preview' })
  getById(@Param('id') id: string) {
    return this.privacyPolicy.getById(id);
  }

  @Put('draft')
  @RequirePermissions('content:manage')
  @ApiOperation({ summary: 'Create or update privacy policy draft (RU/TJ)' })
  saveDraft(@CurrentAdmin() admin: AdminJwtPayload, @Body() body: SavePrivacyDraftDto) {
    return this.privacyPolicy.saveDraft(admin.sub, body);
  }

  @Post(':id/publish')
  @RequirePermissions('content:manage')
  @ApiOperation({ summary: 'Publish draft; archive previous published revision' })
  publish(@CurrentAdmin() admin: AdminJwtPayload, @Param('id') id: string) {
    return this.privacyPolicy.publish(admin.sub, id);
  }
}
