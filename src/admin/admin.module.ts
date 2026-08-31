import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { AuditModule } from '../audit/audit.module';
import { AdminAuthModule } from './auth/admin-auth.module';
import { AdminAuditController } from './audit/admin-audit.controller';
import { AdminAuditService } from './audit/admin-audit.service';
import { AdminDashboardController } from './dashboard/admin-dashboard.controller';
import { AdminDashboardService } from './dashboard/admin-dashboard.service';
import { AdminDevicesController } from './devices/admin-devices.controller';
import { AdminDevicesService } from './devices/admin-devices.service';
import { AdminLicensesController } from './licenses/admin-licenses.controller';
import { AdminLicensesService } from './licenses/admin-licenses.service';
import { AdminSystemController } from './system/admin-system.controller';
import { AdminSystemService } from './system/admin-system.service';
import { AdminTelegramController } from './telegram/admin-telegram.controller';
import { AdminTelegramWebhookController } from './telegram/admin-telegram-webhook.controller';
import { AdminTelegramService } from './telegram/admin-telegram.service';
import { AdminUsersController } from './users/admin-users.controller';
import { AdminUsersService } from './users/admin-users.service';

@Module({
  imports: [AdminAuthModule, AuditModule, TerminusModule],
  controllers: [
    AdminTelegramController,
    AdminTelegramWebhookController,
    AdminDashboardController,
    AdminUsersController,
    AdminLicensesController,
    AdminDevicesController,
    AdminAuditController,
    AdminSystemController,
  ],
  providers: [
    AdminTelegramService,
    AdminDashboardService,
    AdminUsersService,
    AdminLicensesService,
    AdminDevicesService,
    AdminAuditService,
    AdminSystemService,
  ],
  exports: [AdminAuthModule, AdminTelegramService],
})
export class AdminModule {}
