import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditActorType } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { billingPeriodDays, getTelegramI18n } from '../telegram/i18n';
import { formatDateLocalized } from '../telegram/telegram.messages';

@Injectable()
export class TelegramLicenseDeliveryService {
  private readonly logger = new Logger(TelegramLicenseDeliveryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) {}

  async deliverLicenseKey(input: {
    userId: string;
    licenseId: string;
    licenseKey: string;
    expiresAt: Date;
    billingPeriod?: 'MONTHLY' | 'YEARLY';
    planName?: string;
  }): Promise<boolean> {
    const token = this.configService.get<string>('telegram.botToken', '');
    if (!token) {
      this.logger.warn('Skipping Telegram license delivery: TELEGRAM_BOT_TOKEN is not configured');
      return false;
    }

    const account = await this.prisma.telegramAccount.findUnique({
      where: { userId: input.userId },
      select: { chatId: true, telegramId: true, language: true },
    });

    const chatId = account?.chatId ?? account?.telegramId;
    if (!chatId) {
      this.logger.warn({ userId: input.userId }, 'No TelegramAccount chat for license delivery');
      return false;
    }

    const msgs = getTelegramI18n(account?.language);
    const lang = account?.language === 'RU' ? 'RU' : 'TJ';
    const days = billingPeriodDays(input.billingPeriod ?? 'MONTHLY');
    const planName = input.planName ?? 'Standard';
    const text = msgs.paymentApproved(
      planName,
      days,
      formatDateLocalized(input.expiresAt, lang),
      input.licenseKey,
    );

    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: Number(chatId),
        text,
        parse_mode: 'Markdown',
      }),
    });

    if (!response.ok) {
      this.logger.warn(
        { userId: input.userId, status: response.status },
        'Telegram license delivery failed',
      );
      return false;
    }

    await this.auditService.log({
      actorType: AuditActorType.TELEGRAM_BOT,
      actorId: input.userId,
      action: 'telegram.license.delivered',
      entityType: 'License',
      entityId: input.licenseId,
    });

    return true;
  }
}
