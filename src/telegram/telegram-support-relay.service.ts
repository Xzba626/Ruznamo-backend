import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditActorType } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { TelegramBotApiService } from './telegram-bot-api.service';

const MAX_RELAY_TEXT_LENGTH = 3500;

export interface SupportRelayInput {
  telegramUserId: bigint;
  chatId: bigint;
  text: string;
  firstName?: string;
  username?: string;
  orderId?: string;
  orderStatus?: string;
}

export interface SupportMediaRelayInput {
  telegramUserId: bigint;
  chatId: bigint;
  fileId: string;
  fileType: 'photo' | 'document';
  firstName?: string;
  username?: string;
}

@Injectable()
export class TelegramSupportRelayService {
  private readonly logger = new Logger(TelegramSupportRelayService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly botApi: TelegramBotApiService,
    private readonly auditService: AuditService,
  ) {}

  async relayFreeText(input: SupportRelayInput): Promise<'sent' | 'no_admins' | 'failed'> {
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
        await this.botApi.sendPlainMessage(BigInt(adminId), body);
        sent = true;
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
        const chat = BigInt(adminId);
        if (input.fileType === 'photo') {
          await this.botApi.sendPhoto(chat, input.fileId, caption);
        } else {
          await this.botApi.sendDocument(chat, input.fileId, caption);
        }
        sent = true;
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
