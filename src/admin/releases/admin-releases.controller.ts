import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Platform } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';
import { RequirePermissions } from '../decorators/require-permissions.decorator';
import { CurrentAdmin } from '../decorators/current-admin.decorator';
import { AdminJwtAuthGuard } from '../guards/admin-jwt-auth.guard';
import { AdminPermissionsGuard } from '../guards/admin-permissions.guard';
import { AdminJwtPayload } from '../auth/admin-jwt.payload';
import { AdminReleasesService } from './admin-releases.service';
import { UpdateReleaseDraftDto } from './dto/update-release-draft.dto';

@ApiTags('admin-releases')
@ApiBearerAuth()
@UseGuards(AdminJwtAuthGuard, AdminPermissionsGuard)
@Controller('api/v1/admin/releases')
export class AdminReleasesController {
  constructor(private readonly releasesService: AdminReleasesService) {}

  @Get()
  @RequirePermissions('releases:read')
  @ApiOperation({ summary: 'App release overview and history' })
  overview() {
    return this.releasesService.getOverview(Platform.ANDROID);
  }

  @Post('upload-authorization')
  @RequirePermissions('releases:manage')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Issue one-time direct-to-Blob APK upload authorization' })
  createUploadAuthorization(
    @CurrentAdmin() admin: AdminJwtPayload,
    @Body() body: { fileSize?: number },
  ) {
    return this.releasesService.createUploadAuthorization(admin.sub, body?.fileSize);
  }

  @Post('finalize')
  @RequirePermissions('releases:manage')
  @ApiOperation({ summary: 'Validate uploaded Blob object and create DRAFT AppRelease' })
  finalize(@CurrentAdmin() admin: AdminJwtPayload, @Body() body: { uploadId: string }) {
    return this.releasesService.finalizeUpload(admin.sub, body.uploadId);
  }

  @Put(':id')
  @RequirePermissions('releases:manage')
  @ApiOperation({ summary: 'Update draft release metadata' })
  updateDraft(@Param('id') id: string, @Body() body: UpdateReleaseDraftDto) {
    return this.releasesService.updateDraft(id, body);
  }

  @Post(':id/publish')
  @RequirePermissions('releases:manage')
  @ApiOperation({ summary: 'Publish validated draft release' })
  publish(@Param('id') id: string) {
    return this.releasesService.publish(id);
  }

  @Post(':id/archive')
  @RequirePermissions('releases:manage')
  @ApiOperation({ summary: 'Archive non-current release' })
  archive(@Param('id') id: string) {
    return this.releasesService.archive(id);
  }

  @Delete(':id')
  @RequirePermissions('releases:manage')
  @ApiOperation({ summary: 'Delete DRAFT release and its Blob object' })
  deleteDraft(@Param('id') id: string) {
    return this.releasesService.deleteDraft(id);
  }

  @Post(':id/purge-file')
  @RequirePermissions('releases:manage')
  @ApiOperation({ summary: 'Delete ARCHIVED APK binary but keep release history' })
  purgeFile(@Param('id') id: string) {
    return this.releasesService.purgeFile(id);
  }

  @Get(':id/download-url')
  @RequirePermissions('releases:read')
  @ApiOperation({ summary: 'Get short-lived admin download URL for release APK' })
  downloadUrl(@Param('id') id: string) {
    return this.releasesService.getDownloadUrl(id);
  }
}
