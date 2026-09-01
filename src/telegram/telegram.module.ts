import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AdminModule } from '../admin/admin.module';
import { PaymentsModule } from '../payments/payments.module';
import { TelegramBotApiService } from './telegram-bot-api.service';
import { TelegramSupportRelayService } from './telegram-support-relay.service';
import { TelegramUpdateProcessor } from './telegram-update.processor';
import { TelegramWebhookController } from './telegram-webhook.controller';

@Module({
  imports: [AuditModule, PaymentsModule, AdminModule],
  controllers: [TelegramWebhookController],
  providers: [TelegramBotApiService, TelegramSupportRelayService, TelegramUpdateProcessor],
  exports: [TelegramBotApiService],
})
export class TelegramModule {}
