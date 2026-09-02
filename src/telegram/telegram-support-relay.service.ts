import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditActorType, SupportMessageContentType, TelegramLanguage } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { getTelegramI18n } from './i18n';
import { SupportConversationService } from './support-conversation.service';
import { TelegramBotApiService } from './telegram-bot-api.service';

const MAX_RELAY_TEXT_LENGTH = 3500;

export interface SupportRelayInput {
  telegramUserId: bigint;
  chatId: bigint;
  text: string;
  firstName?: string;
  username?: string;
  telegramAccountId?: string;
  orderId?: string;
  orderStatus?: string;
  sourceUserMessageId?: number;
}

export interface SupportMediaRelayInput {
  telegramUserId: bigint;
  chatId: bigint;
  fileId: string;
  fileType: 'photo' | 'document';
  firstName?: string;
  username?: string;
  telegramAccountId?: string;
  sourceUserMessageId?: number;
}

export interface AdminSupportReplyInput {
  adminTelegramId: bigint;
  adminChatId: bigint;
  replyToMessageId: number;
  text?: string;
  caption?: string;
  photoFileId?: string;
  documentFileId?: string;
}

export type AdminSupportReplyResult = 'delivered' | 'unknown_target' | 'empty_content' | 'not_authorized';

@Injectable()
export class TelegramSupportRelayService {
  private readonly logger = new Logger(TelegramSupportRelayService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly botApi: TelegramBotApiService,
    private readonly auditService: AuditService,
    private readonly prisma: PrismaService,
    private readonly supportConversation: SupportConversationService,
  ) {}

  async relayFreeText(input: SupportRelayInput): Promise<'sent' | 'no_admins' | 'failed'> {
    if (input.telegramAccountId) {
      await this.supportConversation.appendUserMessage({
        telegramAccountId: input.telegramAccountId,
        contentType: SupportMessageContentType.TEXT,
        text: input.text,
        telegramMessageId: input.sourceUserMessageId ? BigInt(input.sourceUserMessageId) : undefined,
      });
    }

    const adminIds = this.configService.get<string[]>('telegram.adminTelegramIds', []);
    if (adminIds.length === 0) {
      this.logger.warn('Support relay skipped: ADMIN_TELEGRAM_IDS is empty');
      await this.auditService.log({
        actorType: AuditActorType.TELEGRAM_BOT,
        actorId: input.telegramUserId.toString(),
        action: 'telegram.support.relay.skipped',
        entityType: 'TelegramMessage',
        metadata: { reason: 'no_admin_ids' },
      });
      return 'no_admins';
    }

    const body = this.buildAdminMessage(input);
    let sent = false;

    for (const adminId of adminIds) {
      try {
        const adminChatId = BigInt(adminId);
        const adminMessageId = await this.botApi.sendPlainMessage(adminChatId, body);
        if (adminMessageId != null) {
          await this.storeMapping({
            adminChatId,
            adminMessageId,
            userChatId: input.chatId,
            userTelegramId: input.telegramUserId,
            sourceUserMessageId: input.sourceUserMessageId,
          });
          sent = true;
        }
      } catch (error) {
        this.logger.warn({ adminId, error }, 'Failed to relay support message to admin');
      }
    }

    if (!sent) {
      await this.auditService.log({
        actorType: AuditActorType.TELEGRAM_BOT,
        actorId: input.telegramUserId.toString(),
        action: 'telegram.support.relay.failed',
        entityType: 'TelegramMessage',
      });
      return 'failed';
    }

    await this.auditService.log({
      actorType: AuditActorType.TELEGRAM_BOT,
      actorId: input.telegramUserId.toString(),
      action: 'telegram.support.relayed',
      entityType: 'TelegramMessage',
      metadata: {
        orderId: input.orderId,
        textLength: input.text.length,
      },
    });

    return 'sent';
  }

  async relayMedia(input: SupportMediaRelayInput): Promise<'sent' | 'no_admins' | 'failed'> {
    if (input.telegramAccountId) {
      await this.supportConversation.appendUserMessage({
        telegramAccountId: input.telegramAccountId,
        contentType:
          input.fileType === 'photo'
            ? SupportMessageContentType.PHOTO
            : SupportMessageContentType.DOCUMENT,
        fileId: input.fileId,
        telegramMessageId: input.sourceUserMessageId ? BigInt(input.sourceUserMessageId) : undefined,
      });
    }

    const adminIds = this.configService.get<string[]>('telegram.adminTelegramIds', []);
    if (adminIds.length === 0) {
      this.logger.warn('Support media relay skipped: ADMIN_TELEGRAM_IDS is empty');
      await this.auditService.log({
        actorType: AuditActorType.TELEGRAM_BOT,
        actorId: input.telegramUserId.toString(),
        action: 'telegram.support.media.skipped',
        entityType: 'TelegramMessage',
        metadata: { reason: 'no_admin_ids' },
      });
      return 'no_admins';
    }

    const caption = this.buildMediaCaption(input);
    let sent = false;

    for (const adminId of adminIds) {
      try {
        const adminChatId = BigInt(adminId);
        const adminMessageId =
          input.fileType === 'photo'
            ? await this.botApi.sendPhoto(adminChatId, input.fileId, caption)
            : await this.botApi.sendDocument(adminChatId, input.fileId, caption);
        if (adminMessageId != null) {
          await this.storeMapping({
            adminChatId,
            adminMessageId,
            userChatId: input.chatId,
            userTelegramId: input.telegramUserId,
            sourceUserMessageId: input.sourceUserMessageId,
          });
          sent = true;
        }
      } catch (error) {
        this.logger.warn({ adminId, error }, 'Failed to relay support media to admin');
      }
    }

    if (!sent) {
      return 'failed';
    }

    await this.auditService.log({
      actorType: AuditActorType.TELEGRAM_BOT,
      actorId: input.telegramUserId.toString(),
      action: 'telegram.support.media.relayed',
      entityType: 'TelegramMessage',
      metadata: { fileType: input.fileType },
    });

    return 'sent';
  }

  async deliverAdminReply(input: AdminSupportReplyInput): Promise<AdminSupportReplyResult> {
    const adminIds = this.configService.get<string[]>('telegram.adminTelegramIds', []);
    if (!adminIds.includes(input.adminTelegramId.toString())) {
      return 'not_authorized';
    }

    const mapping = await this.prisma.supportRelayMapping.findUnique({
      where: {
        adminChatId_adminMessageId: {
          adminChatId: input.adminChatId,
          adminMessageId: input.replyToMessageId,
        },
      },
    });

    if (!mapping) {
      return 'unknown_target';
    }

    const body = input.text?.trim() || input.caption?.trim() || '';
    const hasMedia = Boolean(input.photoFileId || input.documentFileId);
    if (!body && !hasMedia) {
      return 'empty_content';
    }

    const userMsgs = await this.resolveUserMessages(mapping.userTelegramId);
    const prefix = userMsgs.supportReplyFromAdmin('');

    if (input.photoFileId) {
      const caption = body ? userMsgs.supportReplyFromAdmin(body) : prefix.trim();
      await this.botApi.sendPhoto(mapping.userChatId, input.photoFileId, caption, undefined);
    } else if (input.documentFileId) {
      const caption = body ? userMsgs.supportReplyFromAdmin(body) : prefix.trim();
      await this.botApi.sendDocument(mapping.userChatId, input.documentFileId, caption, undefined);
    } else {
      await this.botApi.sendPlainMessage(mapping.userChatId, userMsgs.supportReplyFromAdmin(body));
    }

    await this.botApi.removeReplyKeyboard(mapping.userChatId);

    await this.auditService.log({
      actorType: AuditActorType.TELEGRAM_BOT,
      actorId: input.adminTelegramId.toString(),
      action: 'telegram.support.admin_reply.delivered',
      entityType: 'TelegramMessage',
      metadata: {
        userTelegramId: mapping.userTelegramId.toString(),
        mappingId: mapping.id,
      },
    });

    return 'delivered';
  }

  private async storeMapping(input: {
    adminChatId: bigint;
    adminMessageId: number;
    userChatId: bigint;
    userTelegramId: bigint;
    sourceUserMessageId?: number;
  }): Promise<void> {
    await this.prisma.supportRelayMapping.create({
      data: {
        adminChatId: input.adminChatId,
        adminMessageId: input.adminMessageId,
        userChatId: input.userChatId,
        userTelegramId: input.userTelegramId,
        sourceUserMessageId: input.sourceUserMessageId ?? null,
      },
    });
  }

  private async resolveUserMessages(userTelegramId: bigint) {
    const account = await this.prisma.telegramAccount.findUnique({
      where: { telegramId: userTelegramId },
      select: { language: true },
    });
    const lang = account?.language === TelegramLanguage.RU ? TelegramLanguage.RU : TelegramLanguage.TJ;
    return getTelegramI18n(lang);
  }

  private buildMediaCaption(input: SupportMediaRelayInput): string {
    const name = input.firstName?.trim() || '—';
    const username = input.username ? `@${input.username}` : '—';
    return (
      `📎 Вложение в поддержку Ruznamo\n\n` +
      `Имя: ${name}\n` +
      `Username: ${username}\n` +
      `Telegram ID: ${input.telegramUserId.toString()}`
    );
  }

  private buildAdminMessage(input: SupportRelayInput): string {
    const name = input.firstName?.trim() || '—';
    const username = input.username ? `@${input.username}` : '—';
    const text = this.truncate(input.text.trim());
    const orderLine =
      input.orderId != null
        ? `\nЗаявка: ${input.orderId}${input.orderStatus ? ` (${input.orderStatus})` : ''}`
        : '';

    return (
      `📩 Новое сообщение в поддержку Ruznamo\n\n` +
      `Имя: ${name}\n` +
      `Username: ${username}\n` +
      `Telegram ID: ${input.telegramUserId.toString()}` +
      orderLine +
      `\n\nСообщение:\n${text}`
    );
  }

  private truncate(text: string): string {
    if (text.length <= MAX_RELAY_TEXT_LENGTH) {
      return text;
    }
    return `${text.slice(0, MAX_RELAY_TEXT_LENGTH)}…`;
  }
}
