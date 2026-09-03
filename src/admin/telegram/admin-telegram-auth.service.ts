import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdminTelegramIdentityStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

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

    const activeIdentity = await this.prisma.adminTelegramIdentity.findFirst({
      where: {
        telegramUserId,
        status: AdminTelegramIdentityStatus.ACTIVE,
        isVerified: true,
      },
    });
    if (activeIdentity) {
      return true;
    }

    const envIds = this.configService.get<string[]>('telegram.adminTelegramIds', []);
    return envIds.includes(telegramUserId.toString());
  }

  async listActiveAdminTelegramIds(): Promise<string[]> {
    const fromDb = await this.prisma.adminTelegramIdentity.findMany({
      where: { status: AdminTelegramIdentityStatus.ACTIVE, isVerified: true },
      select: { telegramUserId: true },
    });

    const envIds = this.configService.get<string[]>('telegram.adminTelegramIds', []);
    const revoked = await this.prisma.adminTelegramRevokedId.findMany({
      select: { telegramUserId: true },
    });
    const revokedSet = new Set(revoked.map((row) => row.telegramUserId.toString()));

    const merged = new Set<string>();
    for (const row of fromDb) {
      merged.add(row.telegramUserId.toString());
    }
    for (const id of envIds) {
      if (!revokedSet.has(id)) {
        merged.add(id);
      }
    }
    return [...merged];
  }
}
