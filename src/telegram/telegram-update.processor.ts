import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AuditActorType,
  BillingPeriod,
  LicenseStatus,
  OrderStatus,
  PlanCode,
  TelegramLanguage,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AdminTelegramService } from '../admin/telegram/admin-telegram.service';
import {
  extractAdminLinkCodeFromStart,
  normalizeAdminLinkCode,
} from '../admin/telegram/admin-link-code.util';
import { PaymentMethodService } from '../payments/payment-method.service';
import { OrderService } from '../payments/order.service';
import { PaymentApprovalService } from '../payments/payment-approval.service';
import { PaymentConfigService } from '../payments/payment-config.service';
import type { PurchasePlanView } from '../payments/payment-config.service';
import { ResolvedTelegramUser, TelegramAccountService } from '../payments/telegram-account.service';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramBotApiService } from './telegram-bot-api.service';
import { billingPeriodDays, getTelegramI18n, LICENSE_DURATION_DAYS } from './i18n';
import { TelegramSupportRelayService } from './telegram-support-relay.service';
import { TelegramAdminPaymentMethodsService } from './telegram-admin-payment-methods.service';
import { maskLicenseKeyPrefix, resolveOrderTermDays } from './license-term.util';
import {
  adminMainReplyKeyboard,
  inlineMainMenuButton,
  isReplyMenuText,
  userMainReplyKeyboard,
} from './telegram-markup';
import {
  CB,
  formatAmount,
  formatDateLocalized,
  parseDurationCallback,
  parsePaymentCallback,
  parsePaymentMethodCallback,
  parsePlanCallback,
  TG_ADMIN,
} from './telegram.messages';
import { InlineKeyboardMarkup, TelegramReplyMarkup, TelegramUpdate } from './telegram.types';

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
    private readonly paymentMethodService: PaymentMethodService,
    private readonly adminPaymentMethodsService: TelegramAdminPaymentMethodsService,
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

  private i18n(user: ResolvedTelegramUser) {
    return getTelegramI18n(user.language);
  }

  private langCode(user: ResolvedTelegramUser): 'TJ' | 'RU' {
    return user.language === TelegramLanguage.RU ? 'RU' : 'TJ';
  }

  private planDisplayName(
    plan: Pick<PurchasePlanView, 'name' | 'nameTj'>,
    resolved: ResolvedTelegramUser,
  ): string {
    if (resolved.language === TelegramLanguage.TJ && plan.nameTj) {
      return plan.nameTj;
    }
    return plan.name;
  }

  private async sendUserMessage(
    chatId: bigint,
    resolved: ResolvedTelegramUser,
    text: string,
    inline?: InlineKeyboardMarkup,
  ): Promise<void> {
    const reply = userMainReplyKeyboard(this.i18n(resolved));
    if (inline) {
      await this.botApi.sendMessage(chatId, text, inline);
      await this.botApi.sendPlainMessage(chatId, this.i18n(resolved).replyMainMenu, reply);
      return;
    }
    await this.botApi.sendPlainMessage(chatId, text, reply);
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
      await this.handleMediaUpload(
        update,
        telegramId,
        chatId,
        message.photo.at(-1)!.file_id,
        'photo',
        from.username,
        from.first_name,
      );
      return;
    }

    if (message.document) {
      await this.handleMediaUpload(
        update,
        telegramId,
        chatId,
        message.document.file_id,
        'document',
        from.username,
        from.first_name,
      );
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
      const resolved = await this.telegramAccountService.resolveTelegramUser({
        telegramId,
        chatId,
        username: from.username,
        firstName: from.first_name,
      });
      const msgs = this.i18n(resolved);
      await this.sendUserMessage(chatId, resolved, msgs.help);
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
      const handled = await this.adminPaymentMethodsService.handleText(telegramId, chatId, text);
      if (handled) {
        return;
      }
      return;
    }

    const resolved = await this.telegramAccountService.resolveTelegramUser({
      telegramId,
      chatId,
      username: from.username,
      firstName: from.first_name,
    });

    const msgs = this.i18n(resolved);

    if (isReplyMenuText(text, msgs)) {
      if (text === msgs.replyBuyLicense) {
        await this.showBuyFlow(resolved, chatId);
        return;
      }
      if (text === msgs.replyMyLicenses) {
        await this.showMyLicenses(resolved, chatId);
        return;
      }
      if (text === msgs.replySupport) {
        await this.sendUserMessage(chatId, resolved, msgs.help);
        return;
      }
      if (text === msgs.replyLanguage) {
        await this.botApi.sendMessage(chatId, msgs.languageSelect, this.languageKeyboard());
        return;
      }
      if (text === msgs.replyMainMenu) {
        await this.sendMainMenu(resolved, chatId, from.first_name);
        return;
      }
    }

    const awaitingReceipt = await this.orderService.findAwaitingReceiptOrder(resolved.userId);
    if (awaitingReceipt) {
      await this.sendUserMessage(chatId, resolved, msgs.askReceipt);
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
      await this.sendUserMessage(chatId, resolved, msgs.supportRelayed);
    } else {
      await this.sendUserMessage(chatId, resolved, msgs.supportRelayUnavailable);
    }
  }

  private async handleMediaUpload(
    update: TelegramUpdate,
    telegramId: bigint,
    chatId: bigint,
    fileId: string,
    fileType: 'photo' | 'document',
    username?: string,
    firstName?: string,
  ): Promise<void> {
    if (this.isAdmin(telegramId)) {
      return;
    }

    const resolved = await this.telegramAccountService.resolveTelegramUser({
      telegramId,
      chatId,
      username,
      firstName,
    });

    const msgs = this.i18n(resolved);
    const order = await this.orderService.findAwaitingReceiptOrder(resolved.userId);

    if (order) {
      await this.submitReceiptAndNotify(update, resolved, chatId, order.id, fileId, fileType, msgs);
      return;
    }

    this.logger.log({
      updateId: update.update_id,
      telegramUserId: telegramId.toString(),
      handler: 'support_media_relay',
    });

    const relayResult = await this.supportRelay.relayMedia({
      telegramUserId: telegramId,
      chatId,
      fileId,
      fileType,
      firstName,
      username,
    });

    if (relayResult === 'sent') {
      await this.botApi.sendMessage(chatId, msgs.supportAttachmentRelayed);
    } else if (relayResult === 'no_admins') {
      await this.botApi.sendMessage(chatId, msgs.supportRelayUnavailable);
    } else {
      await this.botApi.sendMessage(chatId, msgs.unsupportedAttachment);
    }
  }

  private async submitReceiptAndNotify(
    update: TelegramUpdate,
    resolved: ResolvedTelegramUser,
    chatId: bigint,
    orderId: string,
    fileId: string,
    fileType: 'photo' | 'document',
    msgs: ReturnType<typeof getTelegramI18n>,
  ): Promise<void> {
    const result = await this.orderService.submitReceipt({
      orderId,
      userId: resolved.userId,
      telegramFileId: fileId,
      fileType,
      telegramUpdateId: BigInt(update.update_id),
    });

    if (result.duplicate) {
      return;
    }

    await this.notifyAdminsPaymentReview(result.order.id);
    await this.sendUserMessage(chatId, resolved, msgs.receiptReceived);
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
      await this.botApi.sendMessage(chatId, TG_ADMIN.adminConnected);
      return;
    }

    if (result.reason === 'expired') {
      await this.botApi.sendMessage(chatId, TG_ADMIN.adminConnectExpired);
      return;
    }

    await this.botApi.sendMessage(chatId, TG_ADMIN.adminConnectUnauthorized);
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
      await this.botApi.sendPlainMessage(chatId, TG_ADMIN.adminWelcome, adminMainReplyKeyboard());
      return;
    }

    if (!resolved.language) {
      await this.botApi.sendMessage(chatId, getTelegramI18n(null).languageSelect, this.languageKeyboard());
      return;
    }

    await this.sendMainMenu(resolved, chatId, firstName);
  }

  private async sendMainMenu(
    resolved: ResolvedTelegramUser,
    chatId: bigint,
    firstName?: string,
  ): Promise<void> {
    const msgs = this.i18n(resolved);

    const activeLicense = await this.prisma.license.findFirst({
      where: {
        userId: resolved.userId,
        status: LicenseStatus.ACTIVE,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      include: { plan: true, order: true },
      orderBy: { expiresAt: 'desc' },
    });

    if (activeLicense?.expiresAt) {
      await this.sendUserMessage(
        chatId,
        resolved,
        msgs.welcomeActiveLicense(formatDateLocalized(activeLicense.expiresAt, this.langCode(resolved))),
      );
      return;
    }

    await this.showBuyFlow(resolved, chatId, firstName);
  }

  private async showBuyFlow(
    resolved: ResolvedTelegramUser,
    chatId: bigint,
    firstName?: string,
  ): Promise<void> {
    const msgs = this.i18n(resolved);
    const plans = await this.paymentConfigService.listPurchaseAvailablePlans();

    if (plans.length === 0) {
      await this.sendUserMessage(chatId, resolved, msgs.purchaseUnavailable);
      return;
    }

    await this.sendUserMessage(
      chatId,
      resolved,
      msgs.welcomeNoLicense(firstName),
      await this.planSelectionKeyboard(resolved, plans),
    );
  }

  private async showMyLicenses(resolved: ResolvedTelegramUser, chatId: bigint): Promise<void> {
    const msgs = this.i18n(resolved);
    const license = await this.prisma.license.findFirst({
      where: {
        userId: resolved.userId,
        status: LicenseStatus.ACTIVE,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      include: { plan: true, order: true },
      orderBy: { expiresAt: 'desc' },
    });

    if (!license) {
      await this.sendUserMessage(chatId, resolved, msgs.noActiveLicense);
      return;
    }

    const billingPeriod = license.order?.billingPeriod ?? BillingPeriod.MONTHLY;
    const days = resolveOrderTermDays(billingPeriod);
    await this.sendUserMessage(
      chatId,
      resolved,
      `${msgs.myLicensesTitle}\n\n${msgs.subscriptionInfo(
        license.plan.name,
        days,
        license.expiresAt ? formatDateLocalized(license.expiresAt, this.langCode(resolved)) : '—',
        maskLicenseKeyPrefix(license.keyPrefix),
      )}`,
    );
  }

  private async handleCallback(update: TelegramUpdate): Promise<void> {
    const query = update.callback_query!;
    const data = query.data ?? '';
    const telegramId = BigInt(query.from.id);
    const chatId = BigInt(query.message?.chat.id ?? query.from.id);

    const paymentCallback = parsePaymentCallback(data);
    if (paymentCallback) {
      await this.handleAdminDecision(
        query.id,
        paymentCallback.action,
        paymentCallback.orderId,
        telegramId,
        chatId,
        query.message?.message_id,
      );
      return;
    }

    const adminHandled = await this.adminPaymentMethodsService.handleCallback(
      telegramId,
      chatId,
      data,
      query.id,
    );
    if (adminHandled) {
      return;
    }

    if (data === CB.LANG_TJ || data === CB.LANG_RU) {
      const language = data === CB.LANG_RU ? TelegramLanguage.RU : TelegramLanguage.TJ;
      const resolved = await this.telegramAccountService.resolveTelegramUser({
        telegramId,
        chatId,
        username: query.from.username,
        firstName: query.from.first_name,
      });
      await this.telegramAccountService.setLanguage(resolved.telegramAccountId, language);
      const updated = { ...resolved, language };
      const msgs = this.i18n(updated);
      await this.botApi.answerCallbackQuery(query.id);
      await this.botApi.sendMessage(chatId, msgs.languageChanged);
      await this.sendMainMenu(updated, chatId, query.from.first_name);
      return;
    }

    const resolved = await this.telegramAccountService.resolveTelegramUser({
      telegramId,
      chatId,
      username: query.from.username,
      firstName: query.from.first_name,
    });

    const msgs = this.i18n(resolved);

    const paymentMethodSelection = parsePaymentMethodCallback(data);
    if (paymentMethodSelection) {
      try {
        const method = await this.paymentMethodService.getActiveById(paymentMethodSelection.methodId);
        const order = await this.orderService.getCurrentPendingOrder(resolved.userId);
        if (!order) {
          await this.botApi.answerCallbackQuery(query.id, msgs.noAwaitingOrder);
          return;
        }
        await this.orderService.attachPaymentMethodAndAwaitReceipt(order.id, resolved.userId, method);
        const days = resolveOrderTermDays(order.billingPeriod);
        const lang = this.langCode(resolved);
        const text = msgs.paymentInstructions(
          method.name,
          order.plan.name,
          formatAmount(order.amount.toString(), order.currency, lang),
          days,
          method.paymentValue,
          method.recipientName,
        );
        await this.botApi.answerCallbackQuery(query.id);
        await this.sendUserMessage(chatId, resolved, text, inlineMainMenuButton(msgs));
      } catch {
        await this.botApi.answerCallbackQuery(query.id, msgs.durationUnavailable);
      }
      return;
    }

    if (data === CB.ACTION_MAIN_MENU) {
      await this.botApi.answerCallbackQuery(query.id);
      await this.sendMainMenu(resolved, chatId, query.from.first_name);
      return;
    }

    const planCode = parsePlanCallback(data);
    if (planCode) {
      const available = await this.paymentConfigService.isPlanAvailableForPurchase(planCode);
      if (!available) {
        await this.botApi.answerCallbackQuery(query.id, msgs.planUnavailable);
        await this.sendUserMessage(chatId, resolved, msgs.planUnavailable);
        return;
      }

      const plans = await this.paymentConfigService.listPurchaseAvailablePlans();
      const plan = plans.find((entry) => entry.code === planCode);
      const planName = plan ? this.planDisplayName(plan, resolved) : planCode;
      await this.botApi.sendMessage(
        chatId,
        msgs.chooseDuration(planName),
        await this.durationSelectionKeyboard(resolved, planCode),
      );
      await this.botApi.answerCallbackQuery(query.id);
      return;
    }

    const durationSelection = parseDurationCallback(data);
    if (durationSelection) {
      try {
        const available = await this.paymentConfigService.isPlanAvailableForPurchase(
          durationSelection.planCode,
        );
        if (!available) {
          await this.sendUserMessage(chatId, resolved, msgs.planUnavailable);
          await this.botApi.answerCallbackQuery(query.id, msgs.planUnavailable);
          return;
        }
        await this.startOrderFlow(
          resolved,
          chatId,
          durationSelection.planCode,
          durationSelection.billingPeriod as BillingPeriod,
        );
      } catch {
        await this.sendUserMessage(chatId, resolved, msgs.planUnavailable);
      }
      await this.botApi.answerCallbackQuery(query.id);
      return;
    }

    if (data === CB.ACTION_LANGUAGE) {
      await this.botApi.sendMessage(chatId, msgs.languageSelect, this.languageKeyboard());
      await this.botApi.answerCallbackQuery(query.id);
      return;
    }

    if (data === CB.ACTION_RETRY || data === CB.ACTION_GET_KEY) {
      await this.showBuyFlow(resolved, chatId);
      await this.botApi.answerCallbackQuery(query.id);
      return;
    }

    if (data === CB.ACTION_MY_KEY) {
      const stored = await this.paymentApprovalService.getStoredLicenseKeyForUser(resolved.userId);
      if (stored) {
        const billingPeriod = stored.billingPeriod ?? BillingPeriod.MONTHLY;
        const days = resolveOrderTermDays(billingPeriod);
        await this.sendUserMessage(
          chatId,
          resolved,
          msgs.paymentApproved(
            stored.planName ?? 'Standard',
            days,
            formatDateLocalized(stored.expiresAt ?? new Date(), this.langCode(resolved)),
            stored.key,
          ),
        );
      } else {
        await this.sendUserMessage(chatId, resolved, msgs.noActiveLicense);
      }
      await this.botApi.answerCallbackQuery(query.id);
      return;
    }

    if (data === CB.ACTION_MY_SUB) {
      await this.showMyLicenses(resolved, chatId);
      await this.botApi.answerCallbackQuery(query.id);
      return;
    }

    if (data === CB.ACTION_HELP) {
      await this.sendUserMessage(chatId, resolved, msgs.help);
      await this.botApi.answerCallbackQuery(query.id);
    }
  }

  private async startOrderFlow(
    resolved: ResolvedTelegramUser,
    chatId: bigint,
    planCode: PlanCode,
    billingPeriod: BillingPeriod,
  ): Promise<void> {
    const quote = await this.paymentConfigService.getPlanPriceForPurchase(planCode, billingPeriod);
    const days = billingPeriodDays(billingPeriod);
    const msgs = this.i18n(resolved);
    const lang = this.langCode(resolved);

    await this.orderService.startPaymentFlow(resolved.userId, quote.planId, billingPeriod);

    const summary = msgs.paymentSummary(
      quote.planName,
      days,
      formatAmount(quote.amount, quote.currency, lang),
    );

    const methods = await this.paymentMethodService.listActive();
    if (methods.length === 0) {
      const payment = await this.paymentConfigService.getPaymentDisplayConfig();
      await this.orderService.attachPaymentMethodAndAwaitReceipt(
        (await this.orderService.getCurrentPendingOrder(resolved.userId))!.id,
        resolved.userId,
        {
          name: 'Перевод',
          type: 'CARD' as import('@prisma/client').PaymentMethodType,
          paymentValue: payment.cardNumber ?? '—',
          recipientName: payment.recipientName ?? '—',
        },
      );
      const text = msgs.paymentInstructions(
        'Перевод',
        quote.planName,
        formatAmount(quote.amount, quote.currency, lang),
        days,
        payment.cardNumber ?? '—',
        payment.recipientName ?? '—',
      );
      await this.sendUserMessage(chatId, resolved, `${summary}\n\n${text}`, inlineMainMenuButton(msgs));
      return;
    }

    const keyboard: InlineKeyboardMarkup = {
      inline_keyboard: [
        ...methods.map((method) => [
          { text: method.name, callback_data: CB.paymentMethod(method.id) },
        ]),
        [{ text: msgs.menuBack, callback_data: CB.ACTION_RETRY }],
        [{ text: msgs.replyMainMenu, callback_data: CB.ACTION_MAIN_MENU }],
      ],
    };

    await this.sendUserMessage(chatId, resolved, `${summary}\n\n${msgs.choosePaymentMethod}`, keyboard);
  }

  private async notifyAdminsPaymentReview(orderId: string): Promise<void> {
    const order = await this.orderService.getOrderForAdminReview(orderId);
    if (!order || order.receipts.length === 0) {
      return;
    }

    const receipt = order.receipts[0];
    const tgAccount = order.user.telegramAccount;
    const days = billingPeriodDays(order.billingPeriod);
    const displayName = tgAccount?.firstName ?? order.user.displayName ?? '—';
    const username = tgAccount?.username ? `@${tgAccount.username}` : '—';

    const caption =
      `💳 Новая проверка оплаты\n\n` +
      `Пользователь: ${displayName}\n` +
      `Telegram: ${username}\n` +
      `ID: \`${tgAccount?.telegramId.toString() ?? '—'}\`\n` +
      `Тариф: ${order.plan.name}\n` +
      `Срок: ${days} дней\n` +
      `Сумма: ${order.amount} ${order.currency}\n` +
      `Способ оплаты: ${order.paymentMethodName ?? '—'}\n` +
      `Order: \`${order.id}\`\n` +
      `Время: ${order.createdAt.toISOString()}`;

    const keyboard: InlineKeyboardMarkup = {
      inline_keyboard: [
        [
          { text: '✅ Подтвердить оплату', callback_data: CB.approve(orderId) },
          { text: '❌ Отклонить', callback_data: CB.reject(orderId) },
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
    action: 'approve' | 'reject',
    orderId: string,
    telegramId: bigint,
    adminChatId: bigint,
    adminMessageId?: number,
  ): Promise<void> {
    const resolved = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { user: { include: { telegramAccount: true } } },
    });
    const userLang = resolved?.user.telegramAccount?.language;
    const userMsgs = getTelegramI18n(userLang ?? null);

    if (!this.isAdmin(telegramId)) {
      await this.auditService.log({
        actorType: AuditActorType.TELEGRAM_BOT,
        action: 'telegram.admin.unauthorized',
        entityType: 'TelegramCallback',
        metadata: { telegramUserId: telegramId.toString(), orderId, action },
      });
      await this.botApi.answerCallbackQuery(callbackQueryId, userMsgs.adminUnauthorized);
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
          await this.botApi.answerCallbackQuery(callbackQueryId, userMsgs.adminApprovedDuplicate);
          return;
        }

        const order = await this.orderService.getOrderForAdminReview(orderId);
        const userChatId = order?.user.telegramAccount?.chatId ?? order?.user.telegramAccount?.telegramId;
        const billingPeriod = order?.billingPeriod ?? BillingPeriod.MONTHLY;
        const days = billingPeriodDays(billingPeriod);

        if (userChatId) {
          const resolvedUser = order?.user.telegramAccount
            ? {
                userId: order.userId,
                telegramAccountId: order.user.telegramAccount.id,
                language: order.user.telegramAccount.language,
              }
            : null;
          await this.botApi.sendMessage(
            userChatId,
            userMsgs.paymentApproved(
              order?.plan.name ?? 'Standard',
              days,
              formatDateLocalized(result.expiresAt, userLang === TelegramLanguage.RU ? 'RU' : 'TJ'),
              result.licenseKey,
            ),
          );
          if (resolvedUser?.language) {
            await this.botApi.sendPlainMessage(
              userChatId,
              userMsgs.replyMainMenu,
              userMainReplyKeyboard(userMsgs),
            );
          }
          await this.auditService.log({
            actorType: AuditActorType.TELEGRAM_BOT,
            actorId: order?.userId,
            action: 'telegram.license.delivered',
            entityType: 'License',
            entityId: result.licenseId,
          });
        }

        await this.botApi.answerCallbackQuery(callbackQueryId, '✅ Подтверждено');
        await this.botApi.sendMessage(adminChatId, `✅ Оплата подтверждена\nOrder: ${orderId}`);
        if (adminMessageId) {
          await this.botApi.editMessageReplyMarkup(adminChatId, adminMessageId, { inline_keyboard: [] });
        }
      } catch (error) {
        this.logger.warn({ orderId, error }, 'Approve failed');
        await this.botApi.answerCallbackQuery(callbackQueryId, 'Ошибка');
      }
      return;
    }

    try {
      const result = await this.paymentApprovalService.reject(orderId, actor);
      const order = await this.orderService.getOrderForAdminReview(orderId);
      const userChatId = order?.user.telegramAccount?.chatId ?? order?.user.telegramAccount?.telegramId;
      if (userChatId && !result.alreadyProcessed) {
        await this.botApi.sendMessage(userChatId, userMsgs.paymentRejected, {
          inline_keyboard: [[{ text: userMsgs.replyMainMenu, callback_data: CB.ACTION_MAIN_MENU }]],
        });
        const reply = userMainReplyKeyboard(userMsgs);
        await this.botApi.sendPlainMessage(userChatId, userMsgs.replyMainMenu, reply);
      }
      await this.botApi.answerCallbackQuery(
        callbackQueryId,
        result.alreadyProcessed ? userMsgs.adminRejectedDuplicate : '❌ Отклонено',
      );
      if (!result.alreadyProcessed) {
        await this.botApi.sendMessage(adminChatId, `❌ Оплата отклонена\nOrder: ${orderId}`);
        if (adminMessageId) {
          await this.botApi.editMessageReplyMarkup(adminChatId, adminMessageId, { inline_keyboard: [] });
        }
      }
    } catch (error) {
      this.logger.warn({ orderId, error }, 'Reject failed');
      await this.botApi.answerCallbackQuery(callbackQueryId, 'Ошибка');
    }
  }

  private languageKeyboard(): InlineKeyboardMarkup {
    const msgs = getTelegramI18n(null);
    return {
      inline_keyboard: [
        [
          { text: msgs.languageButtonTj, callback_data: CB.LANG_TJ },
          { text: msgs.languageButtonRu, callback_data: CB.LANG_RU },
        ],
      ],
    };
  }

  private async planSelectionKeyboard(
    resolved: ResolvedTelegramUser,
    plans?: PurchasePlanView[],
  ): Promise<InlineKeyboardMarkup> {
    const msgs = this.i18n(resolved);
    const availablePlans = plans ?? (await this.paymentConfigService.listPurchaseAvailablePlans());

    const rows: InlineKeyboardMarkup['inline_keyboard'] = availablePlans.map((plan) => [
      {
        text: this.planDisplayName(plan, resolved),
        callback_data: CB.plan(plan.code),
      },
    ]);

    rows.push([
      { text: msgs.menuLanguage, callback_data: CB.ACTION_LANGUAGE },
      { text: msgs.menuHelp, callback_data: CB.ACTION_HELP },
    ]);

    return { inline_keyboard: rows };
  }

  private async durationSelectionKeyboard(
    resolved: ResolvedTelegramUser,
    planCode: PlanCode,
  ): Promise<InlineKeyboardMarkup> {
    const msgs = this.i18n(resolved);
    const lang = this.langCode(resolved);
    const prices = await this.paymentConfigService.listActivePlanPrices(planCode);
    const rows: InlineKeyboardMarkup['inline_keyboard'] = [];

    for (const quote of prices) {
      const formatted = formatAmount(quote.amount, quote.currency, lang);
      const days = billingPeriodDays(quote.billingPeriod);
      const label =
        days === LICENSE_DURATION_DAYS.YEARLY
          ? msgs.duration365Days(formatted)
          : msgs.duration30Days(formatted);

      rows.push([
        {
          text: label,
          callback_data: CB.duration(quote.planCode, quote.billingPeriod),
        },
      ]);
    }

    rows.push([{ text: msgs.menuRetry, callback_data: CB.ACTION_RETRY }]);

    return { inline_keyboard: rows };
  }

  private activeLicenseKeyboard(resolved: ResolvedTelegramUser): InlineKeyboardMarkup {
    const msgs = this.i18n(resolved);
    return {
      inline_keyboard: [
        [
          { text: msgs.menuMyKey, callback_data: CB.ACTION_MY_KEY },
          { text: msgs.menuMySub, callback_data: CB.ACTION_MY_SUB },
        ],
        [
          { text: msgs.menuLanguage, callback_data: CB.ACTION_LANGUAGE },
          { text: msgs.menuHelp, callback_data: CB.ACTION_HELP },
        ],
      ],
    };
  }

  private helpKeyboard(resolved: ResolvedTelegramUser): InlineKeyboardMarkup {
    const msgs = this.i18n(resolved);
    return {
      inline_keyboard: [
        [{ text: msgs.menuGetKey, callback_data: CB.ACTION_GET_KEY }],
        [{ text: msgs.menuLanguage, callback_data: CB.ACTION_LANGUAGE }],
      ],
    };
  }
}
