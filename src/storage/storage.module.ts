import { Module } from '@nestjs/common';
import { ObjectStorageService } from './object-storage.service';
import { ReleaseStorageFacade } from './release-storage.facade';
import { VercelBlobReleaseStorageService } from './vercel-blob-release-storage.service';

@Module({
  providers: [ObjectStorageService, VercelBlobReleaseStorageService, ReleaseStorageFacade],
  exports: [ObjectStorageService, VercelBlobReleaseStorageService, ReleaseStorageFacade],
})
export class StorageModule {}
