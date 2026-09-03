import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { AuditModule } from '../audit/audit.module';
import { LicensesModule } from '../licenses/licenses.module';
import { PaymentsModule } from '../payments/payments.module';
import { StorageModule } from '../storage/storage.module';
import { ApkModule } from '../apk/apk.module';
import { SecurityModule } from '../security/security.module';
import { AdminAuthModule } from './auth/admin-auth.module';
import { AdminAuditController } from './audit/admin-audit.controller';
import { AdminAuditService } from './audit/admin-audit.service';
import { AdminDashboardController } from './dashboard/admin-dashboard.controller';
import { AdminDashboardService } from './dashboard/admin-dashboard.service';
import { AdminDevicesController } from './devices/admin-devices.controller';
import { AdminDevicesService } from './devices/admin-devices.service';
import { AdminLicensesController } from './licenses/admin-licenses.controller';
import { AdminLicensesService } from './licenses/admin-licenses.service';
import { AdminOrdersController } from './orders/admin-orders.controller';
import { AdminOrdersService } from './orders/admin-orders.service';
import { AdminSystemController } from './system/admin-system.controller';
import { AdminSystemService } from './system/admin-system.service';
import { AdminTelegramController } from './telegram/admin-telegram.controller';
import { AdminTelegramWebhookController } from './telegram/admin-telegram-webhook.controller';
import { AdminTelegramAuthService } from './telegram/admin-telegram-auth.service';
import { AdminTelegramService } from './telegram/admin-telegram.service';
import { AdminAppConfigController } from './app-config/admin-app-config.controller';
import { AdminAppConfigService } from './app-config/admin-app-config.service';
import { AdminAnalyticsController } from './analytics/admin-analytics.controller';
import { AdminAnalyticsService } from './analytics/admin-analytics.service';
import { AdminPlansController } from './plans/admin-plans.controller';
import { AdminPlansService } from './plans/admin-plans.service';
import { AdminUsersController } from './users/admin-users.controller';
import { AdminUsersService } from './users/admin-users.service';
import { AdminDataResetController } from './data-reset/admin-data-reset.controller';
import { AdminDataResetService } from './data-reset/admin-data-reset.service';
import { AdminReleasesController } from './releases/admin-releases.controller';
import { AdminReleasesService } from './releases/admin-releases.service';

@Module({
  imports: [AdminAuthModule, AuditModule, TerminusModule, PaymentsModule, LicensesModule, StorageModule, ApkModule, SecurityModule],
  controllers: [
    AdminTelegramController,
    AdminTelegramWebhookController,
    AdminDashboardController,
    AdminUsersController,
    AdminLicensesController,
    AdminDevicesController,
    AdminOrdersController,
    AdminAuditController,
    AdminSystemController,
    AdminAppConfigController,
    AdminAnalyticsController,
    AdminPlansController,
    AdminDataResetController,
    AdminReleasesController,
  ],
  providers: [
    AdminTelegramAuthService,
    AdminTelegramService,
    AdminDashboardService,
    AdminUsersService,
    AdminLicensesService,
    AdminDevicesService,
    AdminOrdersService,
    AdminAuditService,
    AdminSystemService,
    AdminAppConfigService,
    AdminAnalyticsService,
    AdminPlansService,
    AdminDataResetService,
    AdminReleasesService,
  ],
  exports: [AdminAuthModule, AdminTelegramService, AdminTelegramAuthService],
})
export class AdminModule {}
