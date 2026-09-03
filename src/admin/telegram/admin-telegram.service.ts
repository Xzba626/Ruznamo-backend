import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdminTelegramIdentityStatus, AuditActorType } from '@prisma/client';
import { createHash, randomBytes, randomInt } from 'crypto';
import { AuditService } from '../../audit/audit.service';
import { PasswordService } from '../../security/password.service';
import { PrismaService } from '../../prisma/prisma.service';
import { normalizeAdminLinkCode } from './admin-link-code.util';

const LINK_CODE_TTL_MINUTES = 15;
const REBIND_TTL_MINUTES = 5;

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

export interface AdminTelegramRebindStartResult {
  expiresAt: Date;
  deepLink: string | null;
  instructions: string;
}

export type RebindOtpBotResult =
  | { ok: true; otp: string; expiresAt: Date }
  | { ok: false; reason: 'invalid' | 'expired' };

@Injectable()
export class AdminTelegramService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
    private readonly passwordService: PasswordService,
  ) {}

  async createConnectToken(adminUserId: string): Promise<AdminTelegramConnectResult> {
    const code = `RZ-${randomBytes(3).toString('hex').toUpperCase()}`;
    const expiresAt = new Date(Date.now() + LINK_CODE_TTL_MINUTES * 60 * 1000);

    await this.prisma.adminTelegramLinkToken.create({
      data: { adminUserId, code, expiresAt },
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

  async startTelegramRebind(
    adminUserId: string,
    currentPassword: string,
  ): Promise<AdminTelegramRebindStartResult> {
    const admin = await this.prisma.adminUser.findUnique({ where: { id: adminUserId } });
    if (!admin?.isActive) {
      throw new UnauthorizedException('Admin account not found');
    }

    const valid = await this.passwordService.verify(currentPassword, admin.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const plainToken = randomBytes(24).toString('base64url');
    const tokenHash = this.hashOpaqueToken(plainToken);
    const expiresAt = new Date(Date.now() + REBIND_TTL_MINUTES * 60 * 1000);

    await this.prisma.adminTelegramRebindChallenge.create({
      data: { adminUserId, tokenHash, expiresAt },
    });

    const botUsername = this.configService.get<string>('telegram.botUsername');
    const startPayload = `admin_link_${plainToken}`;
    const deepLink = botUsername
      ? `https://t.me/${botUsername}?start=${encodeURIComponent(startPayload)}`
      : null;

    await this.auditService.log({
      actorType: AuditActorType.ADMIN,
      actorId: adminUserId,
      action: 'admin.telegram.rebind.started',
      entityType: 'AdminTelegramRebindChallenge',
    });

    return {
      expiresAt,
      deepLink,
      instructions:
        'Откройте Telegram, подтвердите привязку в боте и введите одноразовый код в админ-панели. Код действует 5 минут.',
    };
  }

  async tryIssueRebindOtpFromBot(input: {
    token: string;
    telegramUserId: bigint;
  }): Promise<RebindOtpBotResult> {
    const tokenHash = this.hashOpaqueToken(input.token);
    const challenge = await this.prisma.adminTelegramRebindChallenge.findUnique({
      where: { tokenHash },
    });

    if (!challenge || challenge.consumedAt) {
      return { ok: false, reason: 'invalid' };
    }
    if (challenge.expiresAt < new Date()) {
      return { ok: false, reason: 'expired' };
    }

    const otp = String(randomInt(100000, 1000000));
    const otpHash = await this.passwordService.hash(otp);

    await this.prisma.adminTelegramRebindChallenge.update({
      where: { id: challenge.id },
      data: {
        otpHash,
        telegramUserId: input.telegramUserId,
      },
    });

    return { ok: true, otp, expiresAt: challenge.expiresAt };
  }

  async verifyTelegramRebind(adminUserId: string, otp: string): Promise<AdminTelegramStatus> {
    const challenge = await this.prisma.adminTelegramRebindChallenge.findFirst({
      where: {
        adminUserId,
        consumedAt: null,
        expiresAt: { gt: new Date() },
        otpHash: { not: null },
        telegramUserId: { not: null },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!challenge?.otpHash || !challenge.telegramUserId) {
      throw new BadRequestException('No pending Telegram confirmation. Open the bot link first.');
    }

    const otpValid = await this.passwordService.verify(otp.trim(), challenge.otpHash);
    if (!otpValid) {
      throw new UnauthorizedException('Invalid confirmation code');
    }

    const existingIdentity = await this.prisma.adminTelegramIdentity.findUnique({
      where: { adminUserId },
    });
    const oldTelegramId = existingIdentity?.telegramUserId ?? null;
    const newTelegramId = challenge.telegramUserId;
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      if (oldTelegramId && oldTelegramId !== newTelegramId) {
        await tx.adminTelegramRevokedId.upsert({
          where: { telegramUserId: oldTelegramId },
          create: {
            telegramUserId: oldTelegramId,
            revokedAt: now,
            revokedByAdminUserId: adminUserId,
          },
          update: { revokedAt: now, revokedByAdminUserId: adminUserId },
        });
      }

      await tx.adminTelegramRebindChallenge.update({
        where: { id: challenge.id },
        data: { consumedAt: now },
      });

      await tx.adminTelegramIdentity.upsert({
        where: { adminUserId },
        create: {
          adminUserId,
          telegramUserId: newTelegramId,
          status: AdminTelegramIdentityStatus.ACTIVE,
          isVerified: true,
          verifiedAt: now,
          lastSeenAt: now,
        },
        update: {
          telegramUserId: newTelegramId,
          status: AdminTelegramIdentityStatus.ACTIVE,
          isVerified: true,
          verifiedAt: now,
          revokedAt: null,
          lastSeenAt: now,
        },
      });

      // Newly ACTIVE binding must not remain on the permanent deny-list (same-ID reconnect).
      await tx.adminTelegramRevokedId.deleteMany({
        where: { telegramUserId: newTelegramId },
      });

      await tx.adminUser.update({
        where: { id: adminUserId },
        data: { telegramId: newTelegramId },
      });
    });

    await this.auditService.log({
      actorType: AuditActorType.ADMIN,
      actorId: adminUserId,
      action: 'admin.telegram.replaced',
      entityType: 'AdminTelegramIdentity',
      metadata: {
        oldTelegramUserId: oldTelegramId?.toString() ?? null,
        newTelegramUserId: newTelegramId.toString(),
      },
    });

    return this.getStatus(adminUserId);
  }

  async getStatus(adminUserId: string): Promise<AdminTelegramStatus> {
    const identity = await this.prisma.adminTelegramIdentity.findUnique({
      where: { adminUserId },
    });

    const active =
      identity?.status === AdminTelegramIdentityStatus.ACTIVE && identity.isVerified;

    return {
      connected: Boolean(active),
      isVerified: Boolean(active),
      telegramUserId: active ? identity!.telegramUserId.toString() : null,
      username: active ? identity!.username : null,
      firstName: active ? identity!.firstName : null,
      verifiedAt: active ? identity!.verifiedAt : null,
      lastSeenAt: active ? identity!.lastSeenAt : null,
    };
  }

  async disconnectTelegram(adminUserId: string, currentPassword: string): Promise<AdminTelegramStatus> {
    const admin = await this.prisma.adminUser.findUnique({ where: { id: adminUserId } });
    if (!admin?.isActive) {
      throw new UnauthorizedException('Admin account not found');
    }

    const valid = await this.passwordService.verify(currentPassword, admin.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const identity = await this.prisma.adminTelegramIdentity.findUnique({
      where: { adminUserId },
    });

    if (!identity || identity.status !== AdminTelegramIdentityStatus.ACTIVE) {
      return this.getStatus(adminUserId);
    }

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.adminTelegramIdentity.update({
        where: { adminUserId },
        data: {
          status: AdminTelegramIdentityStatus.REVOKED,
          isVerified: false,
          revokedAt: now,
        },
      });

      await tx.adminTelegramRevokedId.upsert({
        where: { telegramUserId: identity.telegramUserId },
        create: {
          telegramUserId: identity.telegramUserId,
          revokedAt: now,
          revokedByAdminUserId: adminUserId,
        },
        update: { revokedAt: now, revokedByAdminUserId: adminUserId },
      });

      await tx.adminUser.update({
        where: { id: adminUserId },
        data: { telegramId: null },
      });
    });

    await this.auditService.log({
      actorType: AuditActorType.ADMIN,
      actorId: adminUserId,
      action: 'admin.telegram.disconnected',
      entityType: 'AdminTelegramIdentity',
      metadata: { telegramUserId: identity.telegramUserId.toString() },
    });

    return this.getStatus(adminUserId);
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

    if (!token || token.usedAt) {
      return { ok: false, reason: 'invalid' };
    }
    if (token.expiresAt < new Date()) {
      return { ok: false, reason: 'expired' };
    }

    const existingIdentity = await this.prisma.adminTelegramIdentity.findUnique({
      where: { adminUserId: token.adminUserId },
    });
    const oldTelegramId = existingIdentity?.telegramUserId ?? null;
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.adminTelegramLinkToken.update({
        where: { id: token.id },
        data: { usedAt: now },
      });

      if (oldTelegramId && oldTelegramId !== input.telegramUserId) {
        await tx.adminTelegramRevokedId.upsert({
          where: { telegramUserId: oldTelegramId },
          create: {
            telegramUserId: oldTelegramId,
            revokedAt: now,
            revokedByAdminUserId: token.adminUserId,
          },
          update: { revokedAt: now, revokedByAdminUserId: token.adminUserId },
        });
      }

      await tx.adminTelegramIdentity.upsert({
        where: { adminUserId: token.adminUserId },
        create: {
          adminUserId: token.adminUserId,
          telegramUserId: input.telegramUserId,
          chatId: input.chatId,
          username: input.username,
          firstName: input.firstName,
          isVerified: true,
          status: AdminTelegramIdentityStatus.ACTIVE,
          verifiedAt: now,
          lastSeenAt: now,
        },
        update: {
          telegramUserId: input.telegramUserId,
          chatId: input.chatId,
          username: input.username,
          firstName: input.firstName,
          isVerified: true,
          status: AdminTelegramIdentityStatus.ACTIVE,
          revokedAt: null,
          verifiedAt: now,
          lastSeenAt: now,
        },
      });

      await tx.adminTelegramRevokedId.deleteMany({
        where: { telegramUserId: input.telegramUserId },
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
      metadata: { telegramUserId: input.telegramUserId.toString() },
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
    const identity = await this.prisma.adminTelegramIdentity.findFirst({
      where: {
        telegramUserId,
        status: AdminTelegramIdentityStatus.ACTIVE,
        isVerified: true,
      },
    });
    return Boolean(identity);
  }

  private hashOpaqueToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
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
        await this.sendBotMessage(chatId, 'Сначала подключите Telegram через админ-pанель.');
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
