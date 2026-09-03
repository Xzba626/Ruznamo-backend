import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AdminModule } from '../admin/admin.module';
import { AuthModule } from '../auth/auth.module';
import { LicensesModule } from '../licenses/licenses.module';
import { PaymentsModule } from '../payments/payments.module';
import { TelegramAdminPaymentMethodsService } from './telegram-admin-payment-methods.service';
import { TelegramAdminOrderRejectService } from './telegram-admin-order-reject.service';
import { TelegramBotSessionService } from './telegram-bot-session.service';
import { TelegramBotApiService } from './telegram-bot-api.service';
import { TelegramCommandsService } from './telegram-commands.service';
import { TelegramSupportRelayService } from './telegram-support-relay.service';
import { SupportConversationService } from './support-conversation.service';
import { TelegramUpdateProcessor } from './telegram-update.processor';
import { TelegramWebhookController } from './telegram-webhook.controller';
import { ScreenRendererService } from './nav/screen-renderer.service';
import { TelegramAdminLicensesBotService } from './telegram-admin-licenses-bot.service';

@Module({
  imports: [AuditModule, AuthModule, PaymentsModule, AdminModule, LicensesModule],
  controllers: [TelegramWebhookController],
  providers: [
    TelegramBotApiService,
    TelegramBotSessionService,
    ScreenRendererService,
    TelegramCommandsService,
    TelegramAdminPaymentMethodsService,
    TelegramAdminOrderRejectService,
    TelegramAdminLicensesBotService,
    TelegramSupportRelayService,
    SupportConversationService,
    TelegramUpdateProcessor,
  ],
  exports: [TelegramBotApiService],
})
export class TelegramModule {}
