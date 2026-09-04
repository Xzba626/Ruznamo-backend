import { Module } from '@nestjs/common';
import { AppUpdateController } from './app-update.controller';
import { AppUpdateService } from './app-update.service';
import { ReleaseManifestSignerService } from './release-manifest/release-manifest.signer.service';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [StorageModule],
  controllers: [AppUpdateController],
  providers: [AppUpdateService, ReleaseManifestSignerService],
  exports: [AppUpdateService, ReleaseManifestSignerService],
})
export class AppUpdateModule {}
