import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { LicensesModule } from '../licenses/licenses.module';
import { SecurityModule } from '../security/security.module';
import { OrderService } from './order.service';
import { PaymentApprovalService } from './payment-approval.service';
import { PaymentConfigService } from './payment-config.service';
import { TelegramAccountService } from './telegram-account.service';
import { PaymentMethodService } from './payment-method.service';
import { TelegramLicenseDeliveryService } from './telegram-license-delivery.service';

@Module({
  imports: [AuditModule, SecurityModule, LicensesModule],
  providers: [
    PaymentConfigService,
    TelegramAccountService,
    OrderService,
    PaymentApprovalService,
    TelegramLicenseDeliveryService,
    PaymentMethodService,
  ],
  exports: [
    PaymentConfigService,
    TelegramAccountService,
    OrderService,
    PaymentApprovalService,
    TelegramLicenseDeliveryService,
    PaymentMethodService,
  ],
})
export class PaymentsModule {}
