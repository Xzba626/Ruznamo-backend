import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DeviceTelemetryService } from './device-telemetry.service';

@Module({
  imports: [PrismaModule],
  providers: [DeviceTelemetryService],
  exports: [DeviceTelemetryService],
})
export class DeviceTelemetryModule {}
