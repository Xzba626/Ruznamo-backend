import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { PaymentsModule } from '../payments/payments.module';
import { TelegramBotApiService } from './telegram-bot-api.service';
import { TelegramUpdateProcessor } from './telegram-update.processor';
import { TelegramWebhookController } from './telegram-webhook.controller';

@Module({
  imports: [PaymentsModule, AdminModule],
  controllers: [TelegramWebhookController],
  providers: [TelegramBotApiService, TelegramUpdateProcessor],
  exports: [TelegramBotApiService],
})
export class TelegramModule {}
