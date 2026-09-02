import { Module } from '@nestjs/common';
import { AppUpdateController } from './app-update.controller';
import { AppUpdateService } from './app-update.service';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [StorageModule],
  controllers: [AppUpdateController],
  providers: [AppUpdateService],
  exports: [AppUpdateService],
})
export class AppUpdateModule {}
