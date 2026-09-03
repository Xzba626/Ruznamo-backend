import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdminTelegramIdentityStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Telegram Admin authority:
 * 1. Explicitly revoked telegram IDs never regain access (even via env).
 * 2. If Telegram-admin management was ever initialized (any identity row OR any
 *    revoked-id row), env is NEVER used — only ACTIVE DB bindings.
 * 3. Env ADMIN_TELEGRAM_IDS is bootstrap-only when the system was never initialized.
 *
 * Critical: disconnecting the last ACTIVE admin must NOT reopen env fallback.
 */
@Injectable()
export class AdminTelegramAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async isTelegramAdmin(telegramUserId: bigint): Promise<boolean> {
    const revoked = await this.prisma.adminTelegramRevokedId.findUnique({
      where: { telegramUserId },
    });
    if (revoked) {
      return false;
    }

    const initialized = await this.isTelegramAdminManagementInitialized();
    if (initialized) {
      const activeIdentity = await this.prisma.adminTelegramIdentity.findFirst({
        where: {
          telegramUserId,
          status: AdminTelegramIdentityStatus.ACTIVE,
          isVerified: true,
        },
      });
      return Boolean(activeIdentity);
    }

    const envIds = this.configService.get<string[]>('telegram.adminTelegramIds', []);
    return envIds.includes(telegramUserId.toString());
  }

  async listActiveAdminTelegramIds(): Promise<string[]> {
    const revoked = await this.prisma.adminTelegramRevokedId.findMany({
      select: { telegramUserId: true },
    });
    const revokedSet = new Set(revoked.map((row) => row.telegramUserId.toString()));

    const fromDb = await this.prisma.adminTelegramIdentity.findMany({
      where: { status: AdminTelegramIdentityStatus.ACTIVE, isVerified: true },
      select: { telegramUserId: true },
    });

    const merged = new Set<string>();
    for (const row of fromDb) {
      const id = row.telegramUserId.toString();
      if (!revokedSet.has(id)) {
        merged.add(id);
      }
    }

    const initialized = await this.isTelegramAdminManagementInitialized();
    if (!initialized) {
      const envIds = this.configService.get<string[]>('telegram.adminTelegramIds', []);
      for (const id of envIds) {
        if (!revokedSet.has(id)) {
          merged.add(id);
        }
      }
    }

    return [...merged];
  }

  /**
   * Initialized = at least one AdminTelegramIdentity ever existed
   * OR at least one AdminTelegramRevokedId exists.
   * Zero ACTIVE bindings after disconnect still counts as initialized.
   */
  async isTelegramAdminManagementInitialized(): Promise<boolean> {
    const [identityCount, revokedCount] = await Promise.all([
      this.prisma.adminTelegramIdentity.count(),
      this.prisma.adminTelegramRevokedId.count(),
    ]);
    return identityCount > 0 || revokedCount > 0;
  }
}
