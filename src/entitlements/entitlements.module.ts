import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DeviceTelemetryModule } from '../devices/device-telemetry.module';
import { EntitlementService } from './entitlement.service';
import { EntitlementsController } from './entitlements.controller';

@Module({
  imports: [AuthModule, DeviceTelemetryModule],
  controllers: [EntitlementsController],
  providers: [EntitlementService],
  exports: [EntitlementService],
})
export class EntitlementsModule {}
