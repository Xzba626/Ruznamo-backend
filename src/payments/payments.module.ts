import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { SecurityModule } from '../security/security.module';
import { OrderService } from './order.service';
import { PaymentApprovalService } from './payment-approval.service';
import { PaymentConfigService } from './payment-config.service';
import { TelegramAccountService } from './telegram-account.service';

@Module({
  imports: [AuditModule, SecurityModule],
  providers: [
    PaymentConfigService,
    TelegramAccountService,
    OrderService,
    PaymentApprovalService,
  ],
  exports: [
    PaymentConfigService,
    TelegramAccountService,
    OrderService,
    PaymentApprovalService,
  ],
})
export class PaymentsModule {}
