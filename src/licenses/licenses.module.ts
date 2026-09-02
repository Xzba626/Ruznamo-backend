import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { SecurityModule } from '../security/security.module';
import { LicenseIssuanceService } from './license-issuance.service';
import { LicensesController } from './licenses.controller';
import { LicensesService } from './licenses.service';

@Module({
  imports: [AuthModule, EntitlementsModule, SecurityModule, AuditModule],
  controllers: [LicensesController],
  providers: [LicensesService, LicenseIssuanceService],
  exports: [LicensesService, LicenseIssuanceService],
})
export class LicensesModule {}
