import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { SecurityModule } from '../security/security.module';
import { DeviceReplacementService } from './device-replacement.service';
import { LicenseIssuanceService } from './license-issuance.service';
import { LicenseRecoveryService } from './license-recovery.service';
import { LicensesController } from './licenses.controller';
import { LicensesService } from './licenses.service';
import { TelegramLicenseLinkService } from './telegram-license-link.service';

@Module({
  imports: [AuthModule, EntitlementsModule, SecurityModule, AuditModule],
  controllers: [LicensesController],
  providers: [
    LicensesService,
    LicenseIssuanceService,
    TelegramLicenseLinkService,
    DeviceReplacementService,
    LicenseRecoveryService,
  ],
  exports: [
    LicensesService,
    LicenseIssuanceService,
    TelegramLicenseLinkService,
    DeviceReplacementService,
    LicenseRecoveryService,
  ],
})
export class LicensesModule {}
