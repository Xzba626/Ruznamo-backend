import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EntitlementService } from './entitlement.service';
import { EntitlementsController } from './entitlements.controller';

@Module({
  imports: [AuthModule],
  controllers: [EntitlementsController],
  providers: [EntitlementService],
  exports: [EntitlementService],
})
export class EntitlementsModule {}
