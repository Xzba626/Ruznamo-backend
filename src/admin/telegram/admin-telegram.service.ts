import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditActorType } from '@prisma/client';
import { randomBytes } from 'crypto';
import { AuditService } from '../../audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { normalizeAdminLinkCode } from './admin-link-code.util';

const LINK_CODE_TTL_MINUTES = 15;

export type AdminLinkFailureReason = 'invalid' | 'expired' | 'unauthorized';

export type AdminLinkResult =
  | { ok: true }
  | { ok: false; reason: AdminLinkFailureReason };

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
    const deepLink = botUsername ? `https://t.me/${botUsername}?start=${encodeURIComponent(code)}` : null;

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
        'Отправьте код боту: вставьте RZ-… как сообщение, или /start RZ-…, или откройте ссылку ниже. Код действует 15 минут.',
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

  async tryCompleteLinkFromBot(input: {
    code: string;
    telegramUserId: bigint;
    chatId?: bigint;
    username?: string;
    firstName?: string;
  }): Promise<AdminLinkResult> {
    const normalizedCode = normalizeAdminLinkCode(input.code);
    if (!normalizedCode) {
      return { ok: false, reason: 'invalid' };
    }

    const token = await this.prisma.adminTelegramLinkToken.findUnique({
      where: { code: normalizedCode },
    });

    if (!token) {
      return { ok: false, reason: 'invalid' };
    }

    if (token.usedAt) {
      return { ok: false, reason: 'invalid' };
    }

    if (token.expiresAt < new Date()) {
      return { ok: false, reason: 'expired' };
    }

    const envIds = this.configService
      .get<string[]>('telegram.adminTelegramIds', [])
      .map((id) => id.trim())
      .filter(Boolean);
    const telegramIdStr = input.telegramUserId.toString();
    const envAllowed = envIds.length === 0 || envIds.includes(telegramIdStr);

    if (!envAllowed) {
      return { ok: false, reason: 'unauthorized' };
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

    return { ok: true };
  }

  async completeLinkFromBot(input: {
    code: string;
    telegramUserId: bigint;
    chatId?: bigint;
    username?: string;
    firstName?: string;
  }): Promise<void> {
    const result = await this.tryCompleteLinkFromBot(input);
    if (!result.ok) {
      throw new NotFoundException(result.reason);
    }
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
          'Сначала создайте код подключения в админ-панели Ruznamo.',
        );
        return;
      }

      const code = normalizeAdminLinkCode(rawCode);
      if (!code) {
        await this.sendBotMessage(chatId, 'Код подключения недействителен или уже использован.');
        return;
      }

      const result = await this.tryCompleteLinkFromBot({
        code,
        telegramUserId,
        chatId: BigInt(chatId),
        username: message.from.username,
        firstName: message.from.first_name,
      });

      if (result.ok) {
        await this.sendBotMessage(chatId, 'Telegram успешно подключён к админ-панели Ruznamo.');
      } else if (result.reason === 'expired') {
        await this.sendBotMessage(chatId, 'Код подключения истёк. Создайте новый код в админ-панели.');
      } else {
        await this.sendBotMessage(chatId, 'Код подключения недействителен или уже использован.');
      }
      return;
    }

    if (text === '/help') {
      const authorized = await this.isVerifiedTelegramUser(telegramUserId);
      if (!authorized) {
        await this.sendBotMessage(chatId, 'Сначала подключите Telegram через админ-панель.');
        return;
      }
      await this.sendBotMessage(chatId, 'Ruznamo Admin Bot. Команды: /status, /help');
      return;
    }

    if (text === '/status') {
      const authorized = await this.isVerifiedTelegramUser(telegramUserId);
      if (!authorized) {
        await this.sendBotMessage(chatId, 'Сначала подключите Telegram через админ-панель.');
        return;
      }
      await this.sendBotMessage(chatId, 'Статус системы: см. Админ-панель → Система.');
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
