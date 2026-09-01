import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditActorType } from '@prisma/client';
import { randomBytes } from 'crypto';
import { AuditService } from '../../audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';

const LINK_CODE_TTL_MINUTES = 15;

export interface AdminTelegramConnectResult {
  code: string;
  expiresAt: Date;
  deepLink: string | null;
  instructions: string;
}

export interface AdminTelegramStatus {
  connected: boolean;
  isVerified: boolean;
  telegramUserId: string | null;
  username: string | null;
  firstName: string | null;
  verifiedAt: Date | null;
  lastSeenAt: Date | null;
}

@Injectable()
export class AdminTelegramService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) {}

  async createConnectToken(adminUserId: string): Promise<AdminTelegramConnectResult> {
    const code = `RZ-${randomBytes(3).toString('hex').toUpperCase()}`;
    const expiresAt = new Date(Date.now() + LINK_CODE_TTL_MINUTES * 60 * 1000);

    await this.prisma.adminTelegramLinkToken.create({
      data: {
        adminUserId,
        code,
        expiresAt,
      },
    });

    const botUsername = this.configService.get<string>('telegram.botUsername');
    const deepLink = botUsername ? `https://t.me/${botUsername}?start=${code}` : null;

    await this.auditService.log({
      actorType: AuditActorType.ADMIN,
      actorId: adminUserId,
      action: 'admin.telegram.link_token.created',
      entityType: 'AdminTelegramLinkToken',
      metadata: { codePrefix: code.slice(0, 6) },
    });

    return {
      code,
      expiresAt,
      deepLink,
      instructions:
        'Откройте бота Telegram и отправьте /start с этим кодом или используйте ссылку. Код действует 15 минут.',
    };
  }

  async getStatus(adminUserId: string): Promise<AdminTelegramStatus> {
    const identity = await this.prisma.adminTelegramIdentity.findUnique({
      where: { adminUserId },
    });

    return {
      connected: Boolean(identity),
      isVerified: identity?.isVerified ?? false,
      telegramUserId: identity?.telegramUserId?.toString() ?? null,
      username: identity?.username ?? null,
      firstName: identity?.firstName ?? null,
      verifiedAt: identity?.verifiedAt ?? null,
      lastSeenAt: identity?.lastSeenAt ?? null,
    };
  }

  /**
   * Called by Telegram bot webhook (BLOCK 6). Verifies one-time code and binds identity.
   */
  async completeLinkFromBot(input: {
    code: string;
    telegramUserId: bigint;
    chatId?: bigint;
    username?: string;
    firstName?: string;
  }): Promise<void> {
    const token = await this.prisma.adminTelegramLinkToken.findUnique({
      where: { code: input.code },
    });

    if (!token || token.usedAt || token.expiresAt < new Date()) {
      throw new NotFoundException('Invalid or expired Telegram link code');
    }

    const envIds = this.configService
      .get<string[]>('telegram.adminTelegramIds', [])
      .map((id) => id.trim())
      .filter(Boolean);
    const telegramIdStr = input.telegramUserId.toString();
    const envAllowed =
      envIds.length === 0 || envIds.includes(telegramIdStr);

    if (!envAllowed) {
      throw new NotFoundException('Telegram user is not authorized for admin binding');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.adminTelegramLinkToken.update({
        where: { id: token.id },
        data: { usedAt: new Date() },
      });

      await tx.adminTelegramIdentity.upsert({
        where: { adminUserId: token.adminUserId },
        create: {
          adminUserId: token.adminUserId,
          telegramUserId: input.telegramUserId,
          chatId: input.chatId,
          username: input.username,
          firstName: input.firstName,
          isVerified: true,
          verifiedAt: new Date(),
          lastSeenAt: new Date(),
        },
        update: {
          telegramUserId: input.telegramUserId,
          chatId: input.chatId,
          username: input.username,
          firstName: input.firstName,
          isVerified: true,
          verifiedAt: new Date(),
          lastSeenAt: new Date(),
        },
      });

      await tx.adminUser.update({
        where: { id: token.adminUserId },
        data: { telegramId: input.telegramUserId },
      });
    });

    await this.auditService.log({
      actorType: AuditActorType.ADMIN,
      actorId: token.adminUserId,
      action: 'admin.telegram.linked',
      entityType: 'AdminTelegramIdentity',
      metadata: { telegramUserId: telegramIdStr },
    });
  }

  async isVerifiedTelegramUser(telegramUserId: bigint): Promise<boolean> {
    const identity = await this.prisma.adminTelegramIdentity.findUnique({
      where: { telegramUserId },
    });
    return Boolean(identity?.isVerified);
  }

  async processAdminBotUpdate(update: TelegramUpdate): Promise<void> {
    const message = update.message;
    if (!message?.text || !message.from) {
      return;
    }

    const chatId = message.chat.id;
    const telegramUserId = BigInt(message.from.id);
    const text = message.text.trim();

    if (text.startsWith('/start')) {
      const parts = text.split(/\s+/);
      const rawCode = parts[1];

      if (!rawCode) {
        await this.sendBotMessage(
          chatId,
          'Unauthorized. Generate a connection code in the Ruznamo Admin Panel first.',
        );
        return;
      }

      const code = rawCode.startsWith('RZ-') ? rawCode : `RZ-${rawCode.toUpperCase()}`;

      try {
        await this.completeLinkFromBot({
          code,
          telegramUserId,
          chatId: BigInt(chatId),
          username: message.from.username,
          firstName: message.from.first_name,
        });
        await this.sendBotMessage(chatId, 'Telegram connected successfully. You are now linked as admin.');
      } catch {
        await this.sendBotMessage(chatId, 'Invalid or expired connection code.');
      }
      return;
    }

    if (text === '/help') {
      const authorized = await this.isVerifiedTelegramUser(telegramUserId);
      if (!authorized) {
        await this.sendBotMessage(chatId, 'Unauthorized. Connect via Admin Panel first.');
        return;
      }
      await this.sendBotMessage(chatId, 'Ruznamo Admin Bot. Commands: /status, /help');
      return;
    }

    if (text === '/status') {
      const authorized = await this.isVerifiedTelegramUser(telegramUserId);
      if (!authorized) {
        await this.sendBotMessage(chatId, 'Unauthorized.');
        return;
      }
      await this.sendBotMessage(chatId, 'System status: use Admin Panel → System for details.');
    }
  }

  private async sendBotMessage(chatId: number, text: string): Promise<void> {
    const token = this.configService.get<string>('telegram.botToken');
    if (!token) {
      return;
    }

    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
  }
}

export interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    text?: string;
    from?: { id: number; username?: string; first_name?: string };
    chat: { id: number };
  };
}
