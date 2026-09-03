import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdminTelegramIdentityStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Telegram Admin authority:
 * 1. Explicitly revoked telegram IDs never regain access (even via env).
 * 2. If any ACTIVE AdminTelegramIdentity exists in DB → DB is sole authority.
 * 3. Otherwise env ADMIN_TELEGRAM_IDS is bootstrap-only fallback.
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

    const dbAuthorityActive = await this.hasAnyActiveDbBinding();
    if (dbAuthorityActive) {
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

    if (fromDb.length === 0) {
      const envIds = this.configService.get<string[]>('telegram.adminTelegramIds', []);
      for (const id of envIds) {
        if (!revokedSet.has(id)) {
          merged.add(id);
        }
      }
    }

    return [...merged];
  }

  private async hasAnyActiveDbBinding(): Promise<boolean> {
    const count = await this.prisma.adminTelegramIdentity.count({
      where: { status: AdminTelegramIdentityStatus.ACTIVE, isVerified: true },
    });
    return count > 0;
  }
}
