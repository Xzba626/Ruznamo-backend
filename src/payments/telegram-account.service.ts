import { Injectable } from '@nestjs/common';
import { BillingPeriod, PlanCode, TelegramLanguage, UserCategory, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface ResolvedTelegramUser {
  userId: string;
  telegramAccountId: string;
  telegramId: bigint;
  chatId: bigint;
  username: string | null;
  firstName: string | null;
  language: TelegramLanguage | null;
}

@Injectable()
export class TelegramAccountService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveTelegramUser(input: {
    telegramId: bigint;
    chatId: bigint;
    username?: string;
    firstName?: string;
    lastName?: string;
  }): Promise<ResolvedTelegramUser> {
    const existing = await this.prisma.telegramAccount.findUnique({
      where: { telegramId: input.telegramId },
    });

    if (existing) {
      const updated = await this.prisma.telegramAccount.update({
        where: { id: existing.id },
        data: {
          chatId: input.chatId,
          username: input.username,
          firstName: input.firstName,
          lastName: input.lastName,
        },
      });

      return {
        userId: updated.userId,
        telegramAccountId: updated.id,
        telegramId: updated.telegramId,
        chatId: input.chatId,
        username: updated.username,
        firstName: updated.firstName,
        language: updated.language,
      };
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          category: UserCategory.PERSONAL,
          status: UserStatus.ACTIVE,
          displayName: input.firstName ?? null,
        },
      });

      const account = await tx.telegramAccount.create({
        data: {
          userId: user.id,
          telegramId: input.telegramId,
          chatId: input.chatId,
          username: input.username,
          firstName: input.firstName,
          lastName: input.lastName,
        },
      });

      return { user, account };
    });

    return {
      userId: created.user.id,
      telegramAccountId: created.account.id,
      telegramId: created.account.telegramId,
      chatId: input.chatId,
      username: created.account.username,
      firstName: created.account.firstName,
      language: created.account.language,
    };
  }

  async setLanguage(telegramAccountId: string, language: TelegramLanguage): Promise<TelegramLanguage> {
    const updated = await this.prisma.telegramAccount.update({
      where: { id: telegramAccountId },
      data: { language },
    });
    return updated.language ?? language;
  }

  async getChatIdForUser(userId: string): Promise<bigint | null> {
    const account = await this.prisma.telegramAccount.findUnique({ where: { userId } });
    return account?.chatId ?? account?.telegramId ?? null;
  }
}
