import { Module } from '@nestjs/common';
import { AccountModule } from '../account/account.module';
import { AuthModule } from '../auth/auth.module';
import { DevicesModule } from '../devices/devices.module';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { LicensesModule } from '../licenses/licenses.module';

@Module({
  imports: [AuthModule, DevicesModule, AccountModule, EntitlementsModule, LicensesModule],
})
export class MobileModule {}
