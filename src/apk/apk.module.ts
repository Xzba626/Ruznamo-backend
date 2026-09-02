import { Module } from '@nestjs/common';
import { ApkInspectorService } from './apk-inspector.service';

@Module({
  providers: [ApkInspectorService],
  exports: [ApkInspectorService],
})
export class ApkModule {}
