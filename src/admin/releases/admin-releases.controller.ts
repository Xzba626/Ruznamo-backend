import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Platform } from '@prisma/client';
import { RequirePermissions } from '../decorators/require-permissions.decorator';
import { CurrentAdmin } from '../decorators/current-admin.decorator';
import { AdminJwtAuthGuard } from '../guards/admin-jwt-auth.guard';
import { AdminPermissionsGuard } from '../guards/admin-permissions.guard';
import { AdminJwtPayload } from '../auth/admin-jwt.payload';
import { AdminReleasesService } from './admin-releases.service';
import { UpdateReleaseDraftDto } from './dto/update-release-draft.dto';
import { UploadedApkFile } from './admin-releases.service';

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

  @Post('upload')
  @RequirePermissions('releases:manage')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('apk', {
      limits: { fileSize: 250 * 1024 * 1024 },
    }),
  )
  @ApiOperation({ summary: 'Upload APK and create/update draft release' })
  upload(@CurrentAdmin() admin: AdminJwtPayload, @UploadedFile() file: UploadedApkFile) {
    return this.releasesService.uploadDraft(admin.sub, file);
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
  @ApiOperation({ summary: 'Archive release' })
  archive(@Param('id') id: string) {
    return this.releasesService.archive(id);
  }

  @Post(':id/purge-file')
  @RequirePermissions('releases:manage')
  @ApiOperation({ summary: 'Delete APK binary but keep release history' })
  purgeFile(@Param('id') id: string) {
    return this.releasesService.purgeFile(id);
  }

  @Get(':id/download-url')
  @RequirePermissions('releases:read')
  @ApiOperation({ summary: 'Get admin download URL for release APK' })
  downloadUrl(@Param('id') id: string) {
    return this.releasesService.getDownloadUrl(id);
  }
}
