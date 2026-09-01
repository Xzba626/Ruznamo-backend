import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditActorType, BillingPeriod, LicenseStatus, OrderStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AdminTelegramService } from '../admin/telegram/admin-telegram.service';
import {
  extractAdminLinkCodeFromStart,
  normalizeAdminLinkCode,
} from '../admin/telegram/admin-link-code.util';
import { OrderService } from '../payments/order.service';
import { PaymentApprovalService } from '../payments/payment-approval.service';
import { PaymentConfigService } from '../payments/payment-config.service';
import { TelegramAccountService } from '../payments/telegram-account.service';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramBotApiService } from './telegram-bot-api.service';
import { TelegramSupportRelayService } from './telegram-support-relay.service';
import { CB, formatAmount, formatDateTj, TG } from './telegram.messages';
import { InlineKeyboardMarkup, TelegramUpdate } from './telegram.types';

@Injectable()
export class TelegramUpdateProcessor {
  private readonly logger = new Logger(TelegramUpdateProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly botApi: TelegramBotApiService,
    private readonly telegramAccountService: TelegramAccountService,
    private readonly orderService: OrderService,
    private readonly paymentApprovalService: PaymentApprovalService,
    private readonly paymentConfigService: PaymentConfigService,
    private readonly adminTelegramService: AdminTelegramService,
    private readonly supportRelay: TelegramSupportRelayService,
    private readonly auditService: AuditService,
  ) {}

  async processUpdate(update: TelegramUpdate): Promise<void> {
    const claimed = await this.claimUpdate(update.update_id);
    if (!claimed) {
      return;
    }

    if (update.callback_query) {
      await this.handleCallback(update);
      return;
    }

    if (update.message) {
      await this.handleMessage(update);
    }
  }

  private async claimUpdate(updateId: number): Promise<boolean> {
    try {
      await this.prisma.telegramProcessedUpdate.create({ data: { updateId: BigInt(updateId) } });
      return true;
    } catch {
      return false;
    }
  }

  private isAdmin(telegramUserId: bigint): boolean {
    const ids = this.configService.get<string[]>('telegram.adminTelegramIds', []);
    return ids.includes(telegramUserId.toString());
  }

  private async handleMessage(update: TelegramUpdate): Promise<void> {
    const message = update.message!;
    const from = message.from;
    if (!from) {
      return;
    }

    const telegramId = BigInt(from.id);
    const chatId = BigInt(message.chat.id);

    if (message.photo?.length) {
      await this.handleReceiptUpload(update, telegramId, chatId, message.photo.at(-1)!.file_id, 'photo');
      return;
    }

    if (message.document) {
      await this.handleReceiptUpload(update, telegramId, chatId, message.document.file_id, 'document');
      return;
    }

    const text = message.text?.trim();
    if (!text) {
      return;
    }

    if (text.startsWith('/start')) {
      await this.handleStart(text, telegramId, chatId, from.username, from.first_name);
      return;
    }

    if (text === '/help') {
      await this.botApi.sendMessage(chatId, TG.help, this.helpKeyboard());
      return;
    }

    const pairingCode = normalizeAdminLinkCode(text);
    if (pairingCode) {
      this.logger.log({
        updateId: update.update_id,
        telegramUserId: telegramId.toString(),
        handler: 'admin_pairing_plain',
      });
      await this.tryAdminPairing(pairingCode, telegramId, chatId, from.username, from.first_name);
      return;
    }

    if (this.isAdmin(telegramId)) {
      return;
    }

    const resolved = await this.telegramAccountService.resolveTelegramUser({
      telegramId,
      chatId,
      username: from.username,
      firstName: from.first_name,
    });

    const awaitingReceipt = await this.orderService.findAwaitingReceiptOrder(resolved.userId);
    if (awaitingReceipt) {
      await this.botApi.sendMessage(chatId, TG.askReceipt);
      return;
    }

    const activeOrder = await this.prisma.order.findFirst({
      where: {
        userId: resolved.userId,
        status: {
          in: [OrderStatus.PENDING, OrderStatus.RECEIPT_SUBMITTED, OrderStatus.UNDER_REVIEW],
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    this.logger.log({
      updateId: update.update_id,
      telegramUserId: telegramId.toString(),
      handler: 'support_relay',
    });

    const relayResult = await this.supportRelay.relayFreeText({
      telegramUserId: telegramId,
      chatId,
      text,
      firstName: from.first_name,
      username: from.username,
      orderId: activeOrder?.id,
      orderStatus: activeOrder?.status,
    });

    if (relayResult === 'sent') {
      await this.botApi.sendMessage(chatId, TG.supportRelayed);
    } else {
      await this.botApi.sendMessage(chatId, TG.supportRelayUnavailable);
    }
  }

  private async tryAdminPairing(
    code: string,
    telegramId: bigint,
    chatId: bigint,
    username?: string,
    firstName?: string,
  ): Promise<void> {
    const result = await this.adminTelegramService.tryCompleteLinkFromBot({
      code,
      telegramUserId: telegramId,
      chatId,
      username,
      firstName,
    });

    if (result.ok) {
      await this.botApi.sendMessage(chatId, TG.adminConnected);
      return;
    }

    if (result.reason === 'expired') {
      await this.botApi.sendMessage(chatId, TG.adminConnectExpired);
      return;
    }

    await this.botApi.sendMessage(chatId, TG.adminConnectUnauthorized);
  }

  private async handleStart(
    text: string,
    telegramId: bigint,
    chatId: bigint,
    username?: string,
    firstName?: string,
  ): Promise<void> {
    const startCode = extractAdminLinkCodeFromStart(text);
    if (startCode) {
      this.logger.log({
        telegramUserId: telegramId.toString(),
        handler: 'admin_pairing_start',
      });
      await this.tryAdminPairing(startCode, telegramId, chatId, username, firstName);
      return;
    }

    const resolved = await this.telegramAccountService.resolveTelegramUser({
      telegramId,
      chatId,
      username,
      firstName,
    });

    await this.auditService.log({
      actorType: AuditActorType.TELEGRAM_BOT,
      actorId: resolved.userId,
      action: 'telegram.user.started',
      entityType: 'User',
      entityId: resolved.userId,
    });

    if (this.isAdmin(telegramId)) {
      await this.botApi.sendMessage(chatId, TG.adminWelcome);
    }

    const activeLicense = await this.prisma.license.findFirst({
      where: {
        userId: resolved.userId,
        status: LicenseStatus.ACTIVE,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      include: { plan: true },
      orderBy: { expiresAt: 'desc' },
    });

    if (activeLicense?.expiresAt) {
      await this.botApi.sendMessage(
        chatId,
        TG.welcomeActiveLicense(formatDateTj(activeLicense.expiresAt)),
        this.activeLicenseKeyboard(),
      );
      return;
    }

    await this.botApi.sendMessage(
      chatId,
      TG.welcomeNoLicense(firstName),
      this.periodSelectionKeyboard(),
    );
  }

  private async handleCallback(update: TelegramUpdate): Promise<void> {
    const query = update.callback_query!;
    const data = query.data ?? '';
    const telegramId = BigInt(query.from.id);
    const chatId = BigInt(query.message?.chat.id ?? query.from.id);

    if (data.startsWith('approve:') || data.startsWith('reject:')) {
      await this.handleAdminDecision(query.id, data, telegramId, chatId);
      return;
    }

    const resolved = await this.telegramAccountService.resolveTelegramUser({
      telegramId,
      chatId,
      username: query.from.username,
      firstName: query.from.first_name,
    });

    if (data === CB.PERIOD_MONTHLY) {
      await this.startOrderFlow(resolved.userId, chatId, BillingPeriod.MONTHLY);
      await this.botApi.answerCallbackQuery(query.id);
      return;
    }

    if (data === CB.PERIOD_YEARLY) {
      await this.startOrderFlow(resolved.userId, chatId, BillingPeriod.YEARLY);
      await this.botApi.answerCallbackQuery(query.id);
      return;
    }

    if (data === CB.ACTION_PAID) {
      const order = await this.orderService.findAwaitingReceiptOrder(resolved.userId);
      if (!order) {
        const pending = await this.prisma.order.findFirst({
          where: { userId: resolved.userId, status: 'PENDING', awaitingReceipt: false },
          orderBy: { createdAt: 'desc' },
        });
        if (pending) {
          await this.orderService.markAwaitingReceipt(pending.id, resolved.userId);
        } else {
          await this.botApi.answerCallbackQuery(query.id, TG.noAwaitingOrder);
          return;
        }
      }
      await this.botApi.sendMessage(chatId, TG.askReceipt);
      await this.botApi.answerCallbackQuery(query.id);
      return;
    }

    if (data === CB.ACTION_RETRY || data === CB.ACTION_GET_KEY) {
      await this.botApi.sendMessage(chatId, TG.welcomeNoLicense(), this.periodSelectionKeyboard());
      await this.botApi.answerCallbackQuery(query.id);
      return;
    }

    if (data === CB.ACTION_MY_KEY) {
      const stored = await this.paymentApprovalService.getStoredLicenseKeyForUser(resolved.userId);
      if (stored) {
        await this.botApi.sendMessage(
          chatId,
          TG.licenseApproved(formatDateTj(stored.expiresAt ?? new Date()), stored.key),
        );
      } else {
        await this.botApi.sendMessage(chatId, TG.help);
      }
      await this.botApi.answerCallbackQuery(query.id);
      return;
    }

    if (data === CB.ACTION_MY_SUB) {
      const license = await this.prisma.license.findFirst({
        where: { userId: resolved.userId, status: LicenseStatus.ACTIVE },
        include: { plan: true },
        orderBy: { expiresAt: 'desc' },
      });
      if (license) {
        await this.botApi.sendMessage(
          chatId,
          TG.subscriptionInfo(
            license.plan.name,
            license.expiresAt ? formatDateTj(license.expiresAt) : '—',
            license.keyPrefix,
          ),
        );
      } else {
        await this.botApi.sendMessage(chatId, TG.welcomeNoLicense(), this.periodSelectionKeyboard());
      }
      await this.botApi.answerCallbackQuery(query.id);
      return;
    }

    if (data === CB.ACTION_HELP) {
      await this.botApi.sendMessage(chatId, TG.help, this.helpKeyboard());
      await this.botApi.answerCallbackQuery(query.id);
    }
  }

  private async startOrderFlow(userId: string, chatId: bigint, billingPeriod: BillingPeriod): Promise<void> {
    const [monthly, yearly, payment] = await Promise.all([
      this.paymentConfigService.getStandardPrice(BillingPeriod.MONTHLY),
      this.paymentConfigService.getStandardPrice(BillingPeriod.YEARLY),
      this.paymentConfigService.getPaymentDisplayConfig(),
    ]);

    await this.orderService.findOrCreatePendingOrder(userId, billingPeriod);
    const text = TG.paymentInfo(
      formatAmount(monthly.amount, monthly.currency),
      formatAmount(yearly.amount, yearly.currency),
      payment.cardNumber ?? '—',
      payment.recipientName ?? '—',
      payment.instructions ?? '',
    );

    await this.botApi.sendMessage(chatId, text, {
      inline_keyboard: [[{ text: '💳 Ман пардохт кардам', callback_data: CB.ACTION_PAID }]],
    });
  }

  private async handleReceiptUpload(
    update: TelegramUpdate,
    telegramId: bigint,
    chatId: bigint,
    fileId: string,
    fileType: 'photo' | 'document',
  ): Promise<void> {
    const resolved = await this.telegramAccountService.resolveTelegramUser({
      telegramId,
      chatId,
    });

    const order = await this.orderService.findAwaitingReceiptOrder(resolved.userId);
    if (!order) {
      await this.botApi.sendMessage(chatId, TG.noAwaitingOrder);
      return;
    }

    const result = await this.orderService.submitReceipt({
      orderId: order.id,
      userId: resolved.userId,
      telegramFileId: fileId,
      fileType,
      telegramUpdateId: BigInt(update.update_id),
    });

    if (result.duplicate) {
      return;
    }

    await this.botApi.sendMessage(chatId, TG.receiptReceived);
    await this.notifyAdmins(result.order.id);
  }

  private async notifyAdmins(orderId: string): Promise<void> {
    const order = await this.orderService.getOrderForAdminReview(orderId);
    if (!order || order.receipts.length === 0) {
      return;
    }

    const receipt = order.receipts[0];
    const tgAccount = order.user.telegramAccount;
    const periodLabel = order.billingPeriod === BillingPeriod.MONTHLY ? '1 моҳ' : '1 сол';
    const caption =
      `🔔 *Аризаи нав барои пардохт*\n\n` +
      `ID: \`${order.id}\`\n` +
      `Telegram ID: \`${tgAccount?.telegramId.toString() ?? '—'}\`\n` +
      `Муддат: ${periodLabel}\n` +
      `Маблағ: ${order.amount} ${order.currency}\n` +
      `Ҳолат: ${order.status}`;

    const keyboard: InlineKeyboardMarkup = {
      inline_keyboard: [
        [
          { text: '✅ Тасдиқ кардан', callback_data: CB.approve(orderId) },
          { text: '❌ Рад кардан', callback_data: CB.reject(orderId) },
        ],
      ],
    };

    const adminIds = this.configService.get<string[]>('telegram.adminTelegramIds', []);
    for (const adminId of adminIds) {
      const chat = BigInt(adminId);
      try {
        if (receipt.fileType === 'photo') {
          await this.botApi.sendPhoto(chat, receipt.telegramFileId, caption, keyboard);
        } else {
          await this.botApi.sendDocument(chat, receipt.telegramFileId, caption, keyboard);
        }
      } catch (error) {
        this.logger.warn({ adminId, error }, 'Failed to notify admin');
      }
    }
  }

  private async handleAdminDecision(
    callbackQueryId: string,
    data: string,
    telegramId: bigint,
    adminChatId: bigint,
  ): Promise<void> {
    if (!this.isAdmin(telegramId)) {
      await this.auditService.log({
        actorType: AuditActorType.TELEGRAM_BOT,
        action: 'telegram.admin.unauthorized',
        entityType: 'TelegramCallback',
        metadata: { telegramUserId: telegramId.toString(), data },
      });
      await this.botApi.answerCallbackQuery(callbackQueryId, TG.adminUnauthorized);
      return;
    }

    const [action, orderId] = data.split(':');
    if (!orderId?.trim()) {
      await this.botApi.answerCallbackQuery(callbackQueryId, TG.adminUnauthorized);
      return;
    }

    const actor = {
      actorType: AuditActorType.TELEGRAM_BOT,
      actorId: telegramId.toString(),
      telegramUserId: telegramId.toString(),
    };

    if (action === 'approve') {
      try {
        const result = await this.paymentApprovalService.approve(orderId, actor);
        if (result.alreadyProcessed) {
          await this.botApi.answerCallbackQuery(callbackQueryId, TG.adminApprovedDuplicate);
          return;
        }

        const order = await this.orderService.getOrderForAdminReview(orderId);
        const userChatId = order?.user.telegramAccount?.chatId ?? order?.user.telegramAccount?.telegramId;
        if (userChatId) {
          await this.botApi.sendMessage(
            userChatId,
            TG.licenseApproved(formatDateTj(result.expiresAt), result.licenseKey),
          );
          await this.auditService.log({
            actorType: AuditActorType.TELEGRAM_BOT,
            actorId: order?.userId,
            action: 'telegram.license.delivered',
            entityType: 'License',
            entityId: result.licenseId,
          });
        }

        await this.botApi.answerCallbackQuery(callbackQueryId, '✅ Тасдиқ шуд');
        await this.botApi.sendMessage(adminChatId, `✅ Фармоиш ${orderId} тасдиқ шуд.`);
      } catch (error) {
        this.logger.warn({ orderId, error }, 'Approve failed');
        await this.botApi.answerCallbackQuery(callbackQueryId, 'Хatolik');
      }
      return;
    }

    if (action === 'reject') {
      try {
        const result = await this.paymentApprovalService.reject(orderId, actor);
        const order = await this.orderService.getOrderForAdminReview(orderId);
        const userChatId = order?.user.telegramAccount?.chatId ?? order?.user.telegramAccount?.telegramId;
        if (userChatId && !result.alreadyProcessed) {
          await this.botApi.sendMessage(userChatId, TG.licenseRejected, {
            inline_keyboard: [[{ text: '🔄 Пардохтро такрор кардан', callback_data: CB.ACTION_RETRY }]],
          });
        }
        await this.botApi.answerCallbackQuery(
          callbackQueryId,
          result.alreadyProcessed ? TG.adminRejectedDuplicate : '❌ Рад шуд',
        );
      } catch (error) {
        this.logger.warn({ orderId, error }, 'Reject failed');
        await this.botApi.answerCallbackQuery(callbackQueryId, 'Хatolik');
      }
    }
  }

  private periodSelectionKeyboard(): InlineKeyboardMarkup {
    return {
      inline_keyboard: [
        [
          { text: '1 моҳ', callback_data: CB.PERIOD_MONTHLY },
          { text: '1 сол', callback_data: CB.PERIOD_YEARLY },
        ],
        [{ text: '❓ Кӯмак', callback_data: CB.ACTION_HELP }],
      ],
    };
  }

  private activeLicenseKeyboard(): InlineKeyboardMarkup {
    return {
      inline_keyboard: [
        [
          { text: '🔑 Калиди ман', callback_data: CB.ACTION_MY_KEY },
          { text: '📋 Обунаи ман', callback_data: CB.ACTION_MY_SUB },
        ],
        [{ text: '❓ Кӯмак', callback_data: CB.ACTION_HELP }],
      ],
    };
  }

  private helpKeyboard(): InlineKeyboardMarkup {
    return {
      inline_keyboard: [[{ text: '🔑 Калид гирифтан', callback_data: CB.ACTION_GET_KEY }]],
    };
  }
}
