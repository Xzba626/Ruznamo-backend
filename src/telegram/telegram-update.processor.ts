import { Injectable, Logger, HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AuditActorType,
  BillingPeriod,
  LicenseIssueSource,
  LicenseStatus,
  OrderStatus,
  PlanCode,
  TelegramAuthPurpose,
  TelegramLanguage,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AdminTelegramAuthService } from '../admin/telegram/admin-telegram-auth.service';
import { AdminTelegramService } from '../admin/telegram/admin-telegram.service';
import {
  extractAdminLinkCodeFromStart,
  extractAdminRebindTokenFromStart,
  normalizeAdminLinkCode,
} from '../admin/telegram/admin-link-code.util';
import { PaymentMethodService } from '../payments/payment-method.service';
import { OrderService } from '../payments/order.service';
import { PaymentApprovalService } from '../payments/payment-approval.service';
import { PaymentConfigService } from '../payments/payment-config.service';
import type { PurchasePlanView } from '../payments/payment-config.service';
import { ResolvedTelegramUser, TelegramAccountService } from '../payments/telegram-account.service';
import { DeviceReplacementService } from '../licenses/device-replacement.service';
import { TelegramLicenseLinkService } from '../licenses/telegram-license-link.service';
import {
  parseAndroidDeepLink,
  parseAuthStartPayload,
  parseLicenseLinkStartPayload,
  parseReplacementStartPayload,
} from '../licenses/license-link-token.util';
import { TelegramAuthService } from '../auth/telegram-auth.service';
import { LicenseIssuanceService } from '../licenses/license-issuance.service';
import { SupportConversationService } from './support-conversation.service';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramBotApiService } from './telegram-bot-api.service';
import { billingPeriodDays, getTelegramI18n, LICENSE_DURATION_DAYS } from './i18n';
import { readMaxDevicesFromFeatures } from '../admin/common/plan-features.util';
import { parsePlanCode } from '../payments/plan-code.util';
import { TelegramBotSessionService } from './telegram-bot-session.service';
import { TelegramSupportRelayService } from './telegram-support-relay.service';
import { TelegramCommandsService } from './telegram-commands.service';
import { TelegramAdminPaymentMethodsService } from './telegram-admin-payment-methods.service';
import { resolveOrderTermDays } from './license-term.util';
import {
  copyCodeButton,
  isLegacyReplyMenuText,
  languageKeyboard,
  licensesPageKeyboard,
  mainMenuOnlyKeyboard,
  navRow,
  supportActiveKeyboard,
  ADMIN_REPLY_ORDERS,
  ADMIN_REPLY_PAYMENT_METHODS,
} from './telegram-markup';
import {
  BOT_FLOW,
  SUPPORT_CATEGORY,
  type AdminCreateLicensePayload,
  type AdminSupportReplyPayload,
  type SupportCategoryCode,
  type SupportSessionPayload,
} from './bot-flow.constants';
import {
  CB,
  formatAmount,
  formatDateLocalized,
  parseBotCommand,
  parseDurationCallback,
  parsePaymentCallback,
  parsePaymentMethodCallback,
  parsePlanCallback,
  TG_ADMIN,
} from './telegram.messages';
import { InlineKeyboardMarkup, TelegramReplyMarkup, TelegramUpdate } from './telegram.types';

type DeferredStartContext =
  | { kind: 'auth'; authToken: string }
  | { kind: 'android'; androidKind: 'android_license' | 'android_support' }
  | { kind: 'license_link'; linkToken: string }
  | { kind: 'replacement'; replacementToken: string };

@Injectable()
export class TelegramUpdateProcessor {
  private readonly logger = new Logger(TelegramUpdateProcessor.name);
  private static readonly DEFERRED_FLOW = 'deferred_start';

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
    private readonly adminTelegramAuthService: AdminTelegramAuthService,
    private readonly supportRelay: TelegramSupportRelayService,
    private readonly sessionService: TelegramBotSessionService,
    private readonly commandsService: TelegramCommandsService,
    private readonly telegramLicenseLink: TelegramLicenseLinkService,
    private readonly deviceReplacement: DeviceReplacementService,
    private readonly telegramAuthService: TelegramAuthService,
    private readonly supportConversation: SupportConversationService,
    private readonly licenseIssuance: LicenseIssuanceService,
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

  private async isAdmin(telegramUserId: bigint): Promise<boolean> {
    return this.adminTelegramAuthService.isTelegramAdmin(telegramUserId);
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
    _resolved: ResolvedTelegramUser,
    text: string,
    inline?: InlineKeyboardMarkup,
  ): Promise<void> {
    await this.botApi.removeReplyKeyboard(chatId);
    await this.botApi.sendMessage(chatId, text, inline);
  }

  private async clearTransientNav(telegramUserId: bigint): Promise<void> {
    const session = await this.sessionService.getSession(telegramUserId);
    if (session?.flow === 'purchase' || session?.flow === 'support') {
      await this.sessionService.clear(telegramUserId);
    }
  }

  private async isInSupportMode(telegramUserId: bigint): Promise<boolean> {
    const session = await this.sessionService.getSession(telegramUserId);
    return session?.flow === BOT_FLOW.SUPPORT && session.step === 'active';
  }

  private async getSupportConversationId(telegramUserId: bigint): Promise<string | null> {
    const session = await this.sessionService.get<SupportSessionPayload>(
      telegramUserId,
      BOT_FLOW.SUPPORT,
    );
    return session?.conversationId ?? null;
  }

  private async enterSupportMode(telegramUserId: bigint, conversationId: string): Promise<void> {
    await this.sessionService.set(telegramUserId, BOT_FLOW.SUPPORT, 'active', { conversationId });
  }

  private async exitSupportMode(telegramUserId: bigint): Promise<void> {
    const session = await this.sessionService.getSession(telegramUserId);
    if (session?.flow === BOT_FLOW.SUPPORT) {
      await this.sessionService.clear(telegramUserId);
    }
  }

  private async storeDeferredContext(telegramId: bigint, context: DeferredStartContext): Promise<void> {
    await this.sessionService.set(telegramId, TelegramUpdateProcessor.DEFERRED_FLOW, 'pending', {
      ...context,
    });
  }

  private async getDeferredContext(telegramId: bigint): Promise<DeferredStartContext | null> {
    return this.sessionService.get<DeferredStartContext>(telegramId, TelegramUpdateProcessor.DEFERRED_FLOW);
  }

  private async clearDeferredContext(telegramId: bigint): Promise<void> {
    const session = await this.sessionService.getSession(telegramId);
    if (session?.flow === TelegramUpdateProcessor.DEFERRED_FLOW) {
      await this.sessionService.clear(telegramId);
    }
  }

  private async promptLanguageSelection(
    chatId: bigint,
    telegramId: bigint,
    context: DeferredStartContext,
  ): Promise<void> {
    await this.storeDeferredContext(telegramId, context);
    await this.botApi.removeReplyKeyboard(chatId);
    await this.botApi.sendMessage(
      chatId,
      getTelegramI18n(null).languageSelect,
      languageKeyboard(getTelegramI18n(null)),
    );
  }

  private async requireLanguageOrPrompt(
    resolved: ResolvedTelegramUser,
    chatId: bigint,
    telegramId: bigint,
    context: DeferredStartContext,
  ): Promise<boolean> {
    if (resolved.language) {
      return true;
    }
    await this.promptLanguageSelection(chatId, telegramId, context);
    return false;
  }

  private async resumeDeferredContext(
    resolved: ResolvedTelegramUser,
    chatId: bigint,
    telegramId: bigint,
    firstName?: string,
  ): Promise<boolean> {
    const context = await this.getDeferredContext(telegramId);
    if (!context?.kind) {
      return false;
    }

    await this.clearDeferredContext(telegramId);

    switch (context.kind) {
      case 'auth':
        await this.handleTelegramAuthStart(context.authToken, telegramId, chatId, undefined, firstName);
        break;
      case 'android':
        if (context.androidKind === 'android_support') {
          await this.showSupportEntry(resolved, chatId, telegramId);
        } else {
          await this.showBuyFlow(resolved, chatId, firstName, telegramId);
        }
        break;
      case 'license_link':
        await this.presentLicenseLinkPrompt(context.linkToken, telegramId, chatId, undefined, firstName);
        break;
      case 'replacement':
        await this.presentReplacementPrompt(context.replacementToken, telegramId, chatId, undefined, firstName);
        break;
      default:
        return false;
    }

    return true;
  }

  private async clearFlow(telegramUserId: bigint, flow: string): Promise<void> {
    const session = await this.sessionService.getSession(telegramUserId);
    if (session?.flow === flow) {
      await this.sessionService.clear(telegramUserId);
    }
  }

  private async handleAdminTextMessage(
    text: string,
    telegramId: bigint,
    chatId: bigint,
    from: { username?: string; first_name?: string },
  ): Promise<boolean> {
    const replyState = await this.sessionService.get<AdminSupportReplyPayload>(
      telegramId,
      BOT_FLOW.ADMIN_SUPPORT_REPLY,
    );
    if (replyState?.conversationId) {
      const result = await this.supportRelay.deliverConversationReply({
        adminTelegramId: telegramId,
        conversationId: replyState.conversationId,
        targetChatId: BigInt(replyState.targetChatId),
        text,
      });
      await this.clearFlow(telegramId, BOT_FLOW.ADMIN_SUPPORT_REPLY);
      const adminMsgs = getTelegramI18n(TelegramLanguage.RU);
      if (result === 'delivered') {
        await this.botApi.sendPlainMessage(chatId, adminMsgs.adminSupportReplySent);
        await this.showAdminConversationDetail(chatId, replyState.conversationId);
      }
      return true;
    }

    const createState = await this.sessionService.getSession(telegramId);
    if (createState?.flow === BOT_FLOW.ADMIN_CREATE_LICENSE) {
      await this.botApi.sendPlainMessage(
        chatId,
        getTelegramI18n(TelegramLanguage.RU).invalidInputUseButtons,
      );
      return true;
    }

    const handled = await this.adminPaymentMethodsService.handleText(telegramId, chatId, text);
    if (handled) {
      return true;
    }
    if (text === ADMIN_REPLY_PAYMENT_METHODS) {
      await this.adminPaymentMethodsService.showList(chatId);
      return true;
    }
    if (text === ADMIN_REPLY_ORDERS) {
      await this.showPendingOrders(chatId);
      return true;
    }

    return true;
  }

  private async handleAdminMediaMessage(
    message: import('./telegram.types').TelegramMessage,
    telegramId: bigint,
    chatId: bigint,
  ): Promise<boolean> {
    const replyState = await this.sessionService.get<AdminSupportReplyPayload>(
      telegramId,
      BOT_FLOW.ADMIN_SUPPORT_REPLY,
    );
    if (!replyState?.conversationId) {
      return true;
    }

    const photoFileId = message.photo?.at(-1)?.file_id;
    const documentFileId = message.document?.file_id;
    const result = await this.supportRelay.deliverConversationReply({
      adminTelegramId: telegramId,
      conversationId: replyState.conversationId,
      targetChatId: BigInt(replyState.targetChatId),
      text: message.caption,
      caption: message.caption,
      photoFileId,
      documentFileId,
    });
    await this.clearFlow(telegramId, BOT_FLOW.ADMIN_SUPPORT_REPLY);
    const adminMsgs = getTelegramI18n(TelegramLanguage.RU);
    if (result === 'delivered') {
      await this.botApi.sendPlainMessage(chatId, adminMsgs.adminSupportReplySent);
      await this.showAdminConversationDetail(chatId, replyState.conversationId);
    }
    return true;
  }

  private async handleAdminSupportReply(
    message: import('./telegram.types').TelegramMessage,
    adminTelegramId: bigint,
    adminChatId: bigint,
  ): Promise<boolean> {
    const replyTo = message.reply_to_message;
    if (!replyTo) {
      return false;
    }

    const result = await this.supportRelay.deliverAdminReply({
      adminTelegramId,
      adminChatId,
      replyToMessageId: replyTo.message_id,
      text: message.text,
      caption: message.caption,
      photoFileId: message.photo?.at(-1)?.file_id,
      documentFileId: message.document?.file_id,
    });

    if (result === 'not_authorized') {
      return false;
    }

    if (result === 'unknown_target') {
      const adminMsgs = getTelegramI18n(TelegramLanguage.RU);
      await this.botApi.sendPlainMessage(adminChatId, adminMsgs.adminSupportReplyTargetUnknown);
      return true;
    }

    return result === 'delivered' || result === 'empty_content';
  }

  private issueSourceLabel(
    source: import('@prisma/client').LicenseIssueSource | null | undefined,
    msgs: ReturnType<typeof getTelegramI18n>,
  ): string {
    if (source === 'TELEGRAM_PAYMENT') return msgs.sourceTelegram;
    if (source === 'ADMIN_MANUAL') return msgs.sourceManual;
    return msgs.sourceUnknown;
  }

  private maskKeyPrefix(prefix: string): string {
    if (prefix.length <= 4) return `${prefix}••••`;
    return `${prefix.toUpperCase()}••••${prefix.slice(-4)}`;
  }

  private async dispatchBotCommand(
    command: string,
    resolved: ResolvedTelegramUser,
    chatId: bigint,
    telegramId: bigint,
    firstName?: string,
  ): Promise<boolean> {
    const msgs = this.i18n(resolved);
    switch (command) {
      case 'start':
        await this.clearTransientNav(telegramId);
        if (!resolved.language) {
          await this.botApi.removeReplyKeyboard(chatId);
          await this.botApi.sendMessage(chatId, getTelegramI18n(null).languageSelect, languageKeyboard(getTelegramI18n(null)));
          return true;
        }
        await this.sendRootMenu(resolved, chatId, telegramId, firstName);
        return true;
      case 'home':
        await this.clearTransientNav(telegramId);
        await this.sendRootMenu(resolved, chatId, telegramId, firstName);
        return true;
      case 'stop':
        await this.handleStop(resolved, chatId, telegramId);
        return true;
      case 'buy':
        await this.showBuyFlow(resolved, chatId, firstName, telegramId);
        return true;
      case 'licenses':
        await this.showMyLicenses(resolved, chatId, 0);
        return true;
      case 'instruction':
      case 'help':
        await this.showInstruction(resolved, chatId);
        return true;
      case 'support':
        await this.showSupportEntry(resolved, chatId, telegramId);
        return true;
      case 'language':
        await this.botApi.sendMessage(chatId, msgs.languageSelect, languageKeyboard(msgs));
        return true;
      case 'admin':
        if (!(await this.isAdmin(telegramId))) {
          await this.sendUserMessage(chatId, resolved, msgs.adminUnauthorized);
          return true;
        }
        await this.showAdminMenu(resolved, chatId);
        return true;
      case 'requisites':
        if (!(await this.isAdmin(telegramId))) {
          await this.sendUserMessage(chatId, resolved, msgs.adminUnauthorized);
          return true;
        }
        await this.adminPaymentMethodsService.showList(chatId);
        return true;
      case 'orders':
        if (!(await this.isAdmin(telegramId))) {
          await this.sendUserMessage(chatId, resolved, msgs.adminUnauthorized);
          return true;
        }
        await this.showPendingOrders(chatId);
        return true;
      default:
        return false;
    }
  }

  private async handleMessage(update: TelegramUpdate): Promise<void> {
    const message = update.message!;
    const from = message.from;
    if (!from) {
      return;
    }

    const telegramId = BigInt(from.id);
    const chatId = BigInt(message.chat.id);

    if (message.reply_to_message && (await this.isAdmin(telegramId))) {
      const adminReplyHandled = await this.handleAdminSupportReply(message, telegramId, chatId);
      if (adminReplyHandled) {
        return;
      }
    }

    if (await this.isAdmin(telegramId)) {
      if (message.photo?.length || message.document) {
        const adminMediaHandled = await this.handleAdminMediaMessage(message, telegramId, chatId);
        if (adminMediaHandled) {
          return;
        }
      }
    }

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

    const botCommand = parseBotCommand(text);
    if (botCommand) {
      const resolved = await this.telegramAccountService.resolveTelegramUser({
        telegramId,
        chatId,
        username: from.username,
        firstName: from.first_name,
      });
      const handled = await this.dispatchBotCommand(
        botCommand.command,
        resolved,
        chatId,
        telegramId,
        from.first_name,
      );
      if (handled) {
        return;
      }
    }

    if (await this.isAdmin(telegramId)) {
      const handled = await this.handleAdminTextMessage(text, telegramId, chatId, from);
      if (handled) {
        return;
      }
    }

    const resolved = await this.telegramAccountService.resolveTelegramUser({
      telegramId,
      chatId,
      username: from.username,
      firstName: from.first_name,
    });

    const msgs = this.i18n(resolved);

    if (isLegacyReplyMenuText(text, msgs)) {
      await this.botApi.removeReplyKeyboard(chatId);
      if (text === msgs.replyBuyLicense) {
        await this.showBuyFlow(resolved, chatId, from.first_name, telegramId);
        return;
      }
      if (text === msgs.replyMyLicenses) {
        await this.showMyLicenses(resolved, chatId, 0);
        return;
      }
      if (text === msgs.replySupport) {
        await this.showSupportEntry(resolved, chatId, telegramId);
        return;
      }
      if (text === msgs.replyLanguage) {
        await this.botApi.sendMessage(chatId, msgs.languageSelect, languageKeyboard(msgs));
        return;
      }
      if (text === msgs.replyMainMenu) {
        await this.clearTransientNav(telegramId);
        await this.sendMainMenu(resolved, chatId, telegramId, from.first_name);
        return;
      }
    }

    const awaitingReceipt = await this.orderService.findAwaitingReceiptOrder(resolved.userId);
    const inSupport = await this.isInSupportMode(telegramId);

    if (inSupport) {
      const conversationId = (await this.getSupportConversationId(telegramId)) ?? undefined;
      const relayResult = await this.supportRelay.relayFreeText({
        telegramUserId: telegramId,
        chatId,
        text,
        firstName: from.first_name,
        username: from.username,
        telegramAccountId: resolved.telegramAccountId,
        conversationId,
        sourceUserMessageId: message.message_id,
      });

      if (relayResult === 'sent') {
        await this.sendUserMessage(chatId, resolved, msgs.supportMessageSent, supportActiveKeyboard(msgs));
      } else {
        await this.sendUserMessage(chatId, resolved, msgs.supportRelayUnavailable, supportActiveKeyboard(msgs));
      }
      return;
    }

    if (awaitingReceipt) {
      await this.sendUserMessage(chatId, resolved, msgs.paymentAwaitingReceiptHint);
      return;
    }

    return;
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
    const resolved = await this.telegramAccountService.resolveTelegramUser({
      telegramId,
      chatId,
      username,
      firstName,
    });

    const msgs = this.i18n(resolved);
    const inSupport = await this.isInSupportMode(telegramId);
    const order = await this.orderService.findAwaitingReceiptOrder(resolved.userId);

    if (inSupport) {
      const conversationId = (await this.getSupportConversationId(telegramId)) ?? undefined;
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
        telegramAccountId: resolved.telegramAccountId,
        conversationId,
        sourceUserMessageId: update.message?.message_id,
      });

      if (relayResult === 'sent') {
        await this.sendUserMessage(chatId, resolved, msgs.supportMessageSent, supportActiveKeyboard(msgs));
      } else if (relayResult === 'no_admins') {
        await this.sendUserMessage(chatId, resolved, msgs.supportRelayUnavailable, supportActiveKeyboard(msgs));
      } else {
        await this.sendUserMessage(chatId, resolved, msgs.unsupportedAttachment, supportActiveKeyboard(msgs));
      }
      return;
    }

    if (order) {
      await this.submitReceiptAndNotify(update, resolved, chatId, order.id, fileId, fileType, msgs);
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

  private async tryAdminRebind(
    token: string,
    telegramId: bigint,
    chatId: bigint,
  ): Promise<void> {
    const result = await this.adminTelegramService.tryIssueRebindOtpFromBot({
      token,
      telegramUserId: telegramId,
    });

    if (!result.ok) {
      if (result.reason === 'expired') {
        await this.botApi.sendMessage(
          chatId,
          'Ссылка для привязки истекла. Создайте новую в профиле админ-панели.',
        );
      } else {
        await this.botApi.sendMessage(chatId, 'Ссылка для привязки недействительна.');
      }
      return;
    }

    const expiresLabel = result.expiresAt.toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const text =
      'Привязка Telegram администратора Ruznamo\n\n' +
      `Код: ${result.otp}\n\n` +
      `Действует до ${expiresLabel} (5 минут).\n\n` +
      'Введите этот код в админ-панели. Никому не сообщайте код.';

    await this.botApi.sendMessage(chatId, text, copyCodeButton('📋 Копировать код', result.otp));
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
    const rebindToken = extractAdminRebindTokenFromStart(text);
    if (rebindToken) {
      this.logger.log({
        telegramUserId: telegramId.toString(),
        handler: 'admin_rebind_start',
      });
      await this.tryAdminRebind(rebindToken, telegramId, chatId);
      return;
    }

    const startCode = extractAdminLinkCodeFromStart(text);
    if (startCode) {
      this.logger.log({
        telegramUserId: telegramId.toString(),
        handler: 'admin_pairing_start',
      });
      await this.tryAdminPairing(startCode, telegramId, chatId, username, firstName);
      return;
    }

    const androidDeepLink = parseAndroidDeepLink(text);
    if (androidDeepLink) {
      await this.handleAndroidDeepLink(androidDeepLink, telegramId, chatId, username, firstName);
      return;
    }

    const linkToken = parseLicenseLinkStartPayload(text);
    if (linkToken) {
      await this.presentLicenseLinkPrompt(linkToken, telegramId, chatId, username, firstName);
      return;
    }

    const replacementToken = parseReplacementStartPayload(text);
    if (replacementToken) {
      await this.presentReplacementPrompt(replacementToken, telegramId, chatId, username, firstName);
      return;
    }

    const authToken = parseAuthStartPayload(text);
    if (authToken) {
      await this.handleTelegramAuthStart(authToken, telegramId, chatId, username, firstName);
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

    if (await this.isAdmin(telegramId)) {
      await this.botApi.removeReplyKeyboard(chatId);
      await this.commandsService.registerAdminCommandsForChat(chatId);
    }

    if (!resolved.language) {
      await this.botApi.removeReplyKeyboard(chatId);
      await this.botApi.sendMessage(chatId, getTelegramI18n(null).languageSelect, languageKeyboard(getTelegramI18n(null)));
      return;
    }

    await this.sendRootMenu(resolved, chatId, telegramId, firstName);
  }

  private async handleStop(
    resolved: ResolvedTelegramUser,
    chatId: bigint,
    telegramUserId: bigint,
  ): Promise<void> {
    const msgs = this.i18n(resolved);
    await this.exitSupportMode(telegramUserId);
    await this.sessionService.clear(telegramUserId);
    await this.sendUserMessage(chatId, resolved, msgs.stopAcknowledged);
    await this.sendRootMenu(resolved, chatId, telegramUserId);
  }

  private async sendRootMenu(
    resolved: ResolvedTelegramUser,
    chatId: bigint,
    telegramUserId: bigint,
    firstName?: string,
  ): Promise<void> {
    if (await this.isAdmin(telegramUserId)) {
      await this.sendAdminRootMenu(resolved, chatId);
      return;
    }
    await this.sendUserRootMenu(resolved, chatId, firstName);
  }

  private async sendUserRootMenu(
    resolved: ResolvedTelegramUser,
    chatId: bigint,
    firstName?: string,
  ): Promise<void> {
    const msgs = this.i18n(resolved);
    let text = msgs.userStartWelcome;
    const activeLicense = await this.prisma.license.findFirst({
      where: {
        AND: [
          {
            OR: [
              { userId: resolved.userId },
              { holderTelegramAccountId: resolved.telegramAccountId },
              { purchaserTelegramAccountId: resolved.telegramAccountId },
            ],
          },
          { status: LicenseStatus.ACTIVE },
          { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
        ],
      },
      orderBy: { expiresAt: 'desc' },
    });
    if (activeLicense?.expiresAt) {
      text += `\n\n${msgs.welcomeActiveLicense(formatDateLocalized(activeLicense.expiresAt, this.langCode(resolved)))}`;
    }
    await this.sendUserMessage(chatId, resolved, text, this.userRootKeyboard(msgs));
  }

  private userRootKeyboard(msgs: ReturnType<typeof getTelegramI18n>): InlineKeyboardMarkup {
    return {
      inline_keyboard: [
        [{ text: msgs.replyBuyLicense, callback_data: CB.ACTION_GET_KEY }],
        [{ text: msgs.replyMyLicenses, callback_data: CB.ACTION_MY_SUB }],
        [{ text: msgs.replyRecoverAccess, callback_data: CB.ACTION_RECOVER }],
        [{ text: msgs.replyLanguage, callback_data: CB.ACTION_LANGUAGE }],
        [{ text: msgs.replySupport, callback_data: CB.ACTION_SUPPORT }],
        [{ text: msgs.instructionTitle, callback_data: CB.ACTION_INSTRUCTION }],
      ],
    };
  }

  private async sendAdminRootMenu(resolved: ResolvedTelegramUser, chatId: bigint): Promise<void> {
    const msgs = this.i18n(resolved);
    await this.sendUserMessage(chatId, resolved, msgs.adminRootTitle, {
      inline_keyboard: [
        [{ text: msgs.adminMenuOrders, callback_data: 'admin:orders' }],
        [{ text: msgs.adminMenuRequisites, callback_data: 'admin:pm:list' }],
        [{ text: msgs.adminMenuSupport, callback_data: 'admin:support:list' }],
        [{ text: msgs.adminMenuLicenses, callback_data: 'admin:licenses' }],
        [{ text: msgs.adminMenuCreateLicense, callback_data: 'admin:create_license' }],
        [{ text: msgs.replyLanguage, callback_data: CB.ACTION_LANGUAGE }],
      ],
    });
  }

  /** @deprecated use sendRootMenu */
  private async sendMainMenu(
    resolved: ResolvedTelegramUser,
    chatId: bigint,
    telegramUserId: bigint,
    firstName?: string,
  ): Promise<void> {
    await this.sendRootMenu(resolved, chatId, telegramUserId, firstName);
  }

  private async mainMenuKeyboard(
    msgs: ReturnType<typeof getTelegramI18n>,
    telegramUserId: bigint,
  ): Promise<InlineKeyboardMarkup> {
    const rows: InlineKeyboardMarkup['inline_keyboard'] = [
      [{ text: msgs.replyBuyLicense, callback_data: CB.ACTION_GET_KEY }],
      [{ text: msgs.replyMyLicenses, callback_data: CB.ACTION_MY_SUB }],
      [{ text: msgs.replyRecoverAccess, callback_data: CB.ACTION_RECOVER }],
      [{ text: msgs.instructionTitle, callback_data: CB.ACTION_INSTRUCTION }],
      [{ text: msgs.replySupport, callback_data: CB.ACTION_SUPPORT }],
      [{ text: msgs.replyLanguage, callback_data: CB.ACTION_LANGUAGE }],
    ];
    if (await this.isAdmin(telegramUserId)) {
      rows.push([{ text: msgs.replyAdminMenu, callback_data: CB.ACTION_ADMIN_MENU }]);
    }
    return { inline_keyboard: rows };
  }

  private async showAdminMenu(resolved: ResolvedTelegramUser, chatId: bigint): Promise<void> {
    const msgs = this.i18n(resolved);
    await this.sendUserMessage(chatId, resolved, msgs.adminMenuTitle, {
      inline_keyboard: [
        [{ text: msgs.adminMenuOrders, callback_data: 'admin:orders' }],
        [{ text: msgs.adminMenuRequisites, callback_data: 'admin:pm:list' }],
        [{ text: msgs.adminMenuSupport, callback_data: 'admin:support:list' }],
        [{ text: msgs.adminMenuLicenses, callback_data: 'admin:licenses' }],
        [{ text: msgs.adminMenuCreateLicense, callback_data: 'admin:create_license' }],
        [{ text: msgs.replyLanguage, callback_data: CB.ACTION_LANGUAGE }],
        [{ text: msgs.replyMainMenu, callback_data: CB.ACTION_MAIN_MENU }],
      ],
    });
  }

  private async showRecoverAccess(resolved: ResolvedTelegramUser, chatId: bigint): Promise<void> {
    const msgs = this.i18n(resolved);
    await this.sendUserMessage(chatId, resolved, msgs.recoverAccessBody, navRow(msgs, CB.ACTION_MAIN_MENU));
  }

  private async showAdminSupportInbox(chatId: bigint): Promise<void> {
    const items = await this.supportConversation.listOpenConversations();
    const msgs = getTelegramI18n(TelegramLanguage.RU);
    if (items.length === 0) {
      await this.botApi.sendPlainMessage(chatId, msgs.adminSupportEmpty);
      return;
    }
    const rows = items.slice(0, 10).map((item) => [
      {
        text: msgs.adminSupportInboxRow(
          item.ticketLabel,
          `${item.userDisplayName}${item.username ? ` ${item.username}` : ''}`,
          item.category ? msgs.supportCategoryLabel(item.category) : '—',
          item.latestPreview,
        ),
        callback_data: `admin:support:open:${item.id}`,
      },
    ]);
    rows.push([{ text: msgs.adminSupportBackToList, callback_data: 'admin:support:list' }]);
    await this.botApi.sendMessage(
      chatId,
      `${msgs.adminSupportInboxTitle}\n\n${msgs.adminSupportInboxCount(items.length)}`,
      { inline_keyboard: rows },
    );
  }

  private async showAdminConversationDetail(chatId: bigint, conversationId: string): Promise<void> {
    const msgs = getTelegramI18n(TelegramLanguage.RU);
    const conversation = await this.supportConversation.getConversationHistory(conversationId);
    if (!conversation) {
      await this.botApi.sendPlainMessage(chatId, msgs.adminSupportEmpty);
      return;
    }
    const ticket = this.supportConversation.ticketLabel(conversationId);
    const userLabel = conversation.telegramAccount.firstName ?? 'Пользователь';
    const username = conversation.telegramAccount.username
      ? `@${conversation.telegramAccount.username.replace(/^@/, '')}`
      : '—';
    const category = conversation.category
      ? msgs.supportCategoryLabel(conversation.category)
      : '—';
    const created = formatDateLocalized(conversation.createdAt, 'RU');
    const lines = conversation.messages.slice(-8).map((m) => {
      const prefix = m.direction === 'USER_TO_ADMIN' ? '👤' : '🛠';
      const body = m.text ?? m.caption ?? `[${m.contentType}]`;
      return `${prefix} ${body}`;
    });
    const text =
      `${msgs.adminSupportDetailTitle(ticket)}\n\n` +
      `Пользователь: ${userLabel}\n` +
      `Username: ${username}\n` +
      `Telegram ID: ${conversation.telegramAccount.telegramId}\n` +
      `Тема: ${category}\n` +
      `Создано: ${created}\n\n` +
      `Последние сообщения:\n\n${lines.join('\n\n')}`;
    await this.botApi.sendMessage(chatId, text, {
      inline_keyboard: [
        [{ text: msgs.adminSupportReplyButton, callback_data: `admin:support:reply:${conversationId}` }],
        [{ text: '✅ Закрыть обращение', callback_data: `admin:support:close:${conversationId}` }],
        [{ text: msgs.adminSupportBackToList, callback_data: 'admin:support:list' }],
      ],
    });
  }

  private async showInstruction(resolved: ResolvedTelegramUser, chatId: bigint): Promise<void> {
    const msgs = this.i18n(resolved);
    await this.sendUserMessage(
      chatId,
      resolved,
      `${msgs.instructionTitle}\n\n${msgs.instructionBody}`,
      navRow(msgs, CB.ACTION_MAIN_MENU),
    );
  }

  private async showSupportEntry(
    resolved: ResolvedTelegramUser,
    chatId: bigint,
    telegramUserId: bigint,
  ): Promise<void> {
    const msgs = this.i18n(resolved);
    await this.sessionService.set(telegramUserId, BOT_FLOW.SUPPORT, 'category', {});
    await this.sendUserMessage(chatId, resolved, msgs.supportCategoryPrompt, {
      inline_keyboard: [
        [{ text: msgs.supportCategoryTechnical, callback_data: CB.supportCategory(SUPPORT_CATEGORY.TECHNICAL) }],
        [{ text: msgs.supportCategoryLicense, callback_data: CB.supportCategory(SUPPORT_CATEGORY.LICENSE) }],
        [{ text: msgs.supportCategoryPayment, callback_data: CB.supportCategory(SUPPORT_CATEGORY.PAYMENT) }],
        [{ text: msgs.supportCategoryDevice, callback_data: CB.supportCategory(SUPPORT_CATEGORY.DEVICE) }],
        [{ text: msgs.supportCategoryOther, callback_data: CB.supportCategory(SUPPORT_CATEGORY.OTHER) }],
        [{ text: msgs.menuBack, callback_data: CB.ACTION_MAIN_MENU }],
      ],
    });
  }

  private async activateSupportConversation(
    resolved: ResolvedTelegramUser,
    chatId: bigint,
    telegramUserId: bigint,
    category: SupportCategoryCode,
  ): Promise<void> {
    const msgs = this.i18n(resolved);
    const conversation = await this.supportConversation.createConversation(
      resolved.telegramAccountId,
      category,
    );
    await this.enterSupportMode(telegramUserId, conversation.id);
    await this.sendUserMessage(chatId, resolved, msgs.supportWelcome, supportActiveKeyboard(msgs));
  }

  private async showPendingOrders(chatId: bigint): Promise<void> {
    await this.adminPaymentMethodsService.showPendingOrders(chatId);
  }

  private async showBuyFlow(
    resolved: ResolvedTelegramUser,
    chatId: bigint,
    _firstName?: string,
    telegramId?: bigint,
  ): Promise<void> {
    const msgs = this.i18n(resolved);
    const plans = await this.paymentConfigService.listPurchaseAvailablePlans();

    if (plans.length === 0) {
      await this.sendUserMessage(chatId, resolved, msgs.purchaseUnavailable);
      return;
    }

    const onlyStandard =
      plans.length === 1 && plans[0]?.code === PlanCode.STANDARD && telegramId != null;
    if (onlyStandard) {
      await this.showStandardTariffCard(resolved, chatId, telegramId);
      return;
    }

    await this.sendUserMessage(
      chatId,
      resolved,
      msgs.choosePlan,
      await this.planSelectionKeyboard(resolved, plans),
    );
  }

  private async showStandardTariffCard(
    resolved: ResolvedTelegramUser,
    chatId: bigint,
    telegramId: bigint,
  ): Promise<void> {
    const msgs = this.i18n(resolved);
    const lang = this.langCode(resolved);
    const prices = await this.paymentConfigService.listActivePlanPrices(PlanCode.STANDARD);
    const monthly = prices.find((quote) => quote.billingPeriod === BillingPeriod.MONTHLY);
    const yearly = prices.find((quote) => quote.billingPeriod === BillingPeriod.YEARLY);
    const monthlyPrice = monthly ? formatAmount(monthly.amount, monthly.currency, lang) : '—';
    const yearlyPrice = yearly ? formatAmount(yearly.amount, yearly.currency, lang) : '—';

    await this.sessionService.set(telegramId, BOT_FLOW.PURCHASE, 'tariff_card', {
      planCode: PlanCode.STANDARD,
    });
    const rows: InlineKeyboardMarkup['inline_keyboard'] = [];
    if (monthly) {
      rows.push([
        {
          text: msgs.standardDurationMonthButton(monthlyPrice),
          callback_data: CB.duration(PlanCode.STANDARD, BillingPeriod.MONTHLY),
        },
      ]);
    }
    if (yearly) {
      rows.push([
        {
          text: msgs.standardDurationYearButton(yearlyPrice),
          callback_data: CB.duration(PlanCode.STANDARD, BillingPeriod.YEARLY),
        },
      ]);
    }
    rows.push([{ text: msgs.menuBack, callback_data: CB.ACTION_MAIN_MENU }]);
    await this.sendUserMessage(chatId, resolved, msgs.standardTariffCard(), { inline_keyboard: rows });
  }

  private async showPlanDurationSelection(
    resolved: ResolvedTelegramUser,
    chatId: bigint,
    telegramId: bigint,
    planCode: PlanCode,
  ): Promise<void> {
    const msgs = this.i18n(resolved);
    const plans = await this.paymentConfigService.listPurchaseAvailablePlans();
    const plan = plans.find((entry) => entry.code === planCode);
    const planName = plan ? this.planDisplayName(plan, resolved) : planCode;
    await this.sessionService.set(telegramId, 'purchase', 'duration', { planCode });
    await this.botApi.sendMessage(
      chatId,
      msgs.chooseDuration(planName),
      await this.durationSelectionKeyboard(resolved, planCode),
    );
  }

  private async showMyLicenses(
    resolved: ResolvedTelegramUser,
    chatId: bigint,
    page = 0,
  ): Promise<void> {
    const msgs = this.i18n(resolved);
    const pageSize = 3;
    const licenses = await this.prisma.license.findMany({
      where: {
        OR: [
          { userId: resolved.userId },
          { holderTelegramAccountId: resolved.telegramAccountId },
          { purchaserTelegramAccountId: resolved.telegramAccountId },
        ],
      },
      include: {
        plan: { include: { features: true } },
        order: true,
        activations: { include: { device: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (licenses.length === 0) {
      await this.sendUserMessage(chatId, resolved, msgs.noActiveLicense);
      return;
    }

    const totalPages = Math.max(1, Math.ceil(licenses.length / pageSize));
    const safePage = Math.min(Math.max(page, 0), totalPages - 1);
    const slice = licenses.slice(safePage * pageSize, safePage * pageSize + pageSize);

    const blocks = slice.map((license) => {
      const billingPeriod = license.order?.billingPeriod ?? BillingPeriod.MONTHLY;
      const days = resolveOrderTermDays(billingPeriod);
      const deviceLimit = readMaxDevicesFromFeatures(license.plan.features, 2);
      const devicesUsed = license.activations.filter(
        (a) => !a.revokedAt && !a.device.revokedAt,
      ).length;
      const expires = license.expiresAt
        ? formatDateLocalized(license.expiresAt, this.langCode(resolved))
        : '—';
      return msgs.licenseListItem(
        license.plan.name,
        license.status,
        expires,
        devicesUsed,
        deviceLimit ?? 2,
        this.issueSourceLabel(license.issueSource, msgs),
        this.maskKeyPrefix(license.keyPrefix),
      );
    });

    await this.sendUserMessage(
      chatId,
      resolved,
      `${msgs.myLicensesTitle}\n\n${blocks.join('\n\n—\n\n')}`,
      this.licensesListKeyboard(msgs, slice, safePage, totalPages),
    );
  }

  private licensesListKeyboard(
    msgs: ReturnType<typeof getTelegramI18n>,
    licenses: Array<{ id: string; holderTelegramAccountId: string | null }>,
    page: number,
    totalPages: number,
  ): InlineKeyboardMarkup {
    const rows: InlineKeyboardMarkup['inline_keyboard'] = [];
    for (const license of licenses) {
      if (license.holderTelegramAccountId) {
        rows.push([
          {
            text: `📱 ${msgs.licenseDevicesTitle}`,
            callback_data: CB.licenseDevices(license.id),
          },
        ]);
      }
    }
    const nav: InlineKeyboardMarkup['inline_keyboard'][number] = [];
    if (page > 0) {
      nav.push({ text: '◀️', callback_data: `licenses:page:${page - 1}` });
    }
    if (page + 1 < totalPages) {
      nav.push({ text: '▶️', callback_data: `licenses:page:${page + 1}` });
    }
    if (nav.length) {
      rows.push(nav);
    }
    rows.push([{ text: msgs.replyMainMenu, callback_data: CB.ACTION_MAIN_MENU }]);
    return { inline_keyboard: rows };
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
      const resumed = await this.resumeDeferredContext(
        updated,
        chatId,
        telegramId,
        query.from.first_name,
      );
      if (!resumed) {
        await this.sendRootMenu(updated, chatId, telegramId, query.from.first_name);
      }
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
        await this.sendUserMessage(chatId, resolved, text, navRow(msgs, CB.ACTION_BACK_DURATION));
      } catch {
        await this.botApi.answerCallbackQuery(query.id, msgs.durationUnavailable);
      }
      return;
    }

    if (data === CB.ACTION_MAIN_MENU) {
      await this.botApi.answerCallbackQuery(query.id);
      await this.clearTransientNav(telegramId);
      await this.sendRootMenu(resolved, chatId, telegramId, query.from.first_name);
      return;
    }

    if (data.startsWith('support:cat:')) {
      await this.botApi.answerCallbackQuery(query.id);
      const category = data.slice('support:cat:'.length) as SupportCategoryCode;
      await this.activateSupportConversation(resolved, chatId, telegramId, category);
      return;
    }

    if (data === CB.ACTION_SUPPORT_EXIT) {
      await this.botApi.answerCallbackQuery(query.id);
      await this.sendUserMessage(chatId, resolved, msgs.supportCloseConfirm, {
        inline_keyboard: [
          [{ text: msgs.supportCloseConfirmYes, callback_data: CB.ACTION_SUPPORT_CLOSE_CONFIRM }],
          [{ text: msgs.supportCloseConfirmNo, callback_data: CB.ACTION_SUPPORT_CLOSE_CANCEL }],
        ],
      });
      return;
    }

    if (data === CB.ACTION_SUPPORT_CLOSE_CONFIRM) {
      await this.botApi.answerCallbackQuery(query.id);
      const conversationId = await this.getSupportConversationId(telegramId);
      if (conversationId) {
        await this.supportConversation.closeConversation(conversationId);
      }
      await this.exitSupportMode(telegramId);
      await this.sendUserMessage(chatId, resolved, msgs.supportClosedFinal, mainMenuOnlyKeyboard(msgs));
      return;
    }

    if (data === CB.ACTION_SUPPORT_CLOSE_CANCEL) {
      await this.botApi.answerCallbackQuery(query.id);
      await this.sendUserMessage(chatId, resolved, msgs.supportWelcome, supportActiveKeyboard(msgs));
      return;
    }

    if (data === CB.ACTION_RECOVER) {
      await this.botApi.answerCallbackQuery(query.id);
      await this.showRecoverAccess(resolved, chatId);
      return;
    }

    if (data === CB.ACTION_ADMIN_MENU) {
      await this.botApi.answerCallbackQuery(query.id);
      if (!(await this.isAdmin(telegramId))) {
        await this.sendUserMessage(chatId, resolved, msgs.adminUnauthorized);
        return;
      }
      await this.showAdminMenu(resolved, chatId);
      return;
    }

    if (data === 'admin:support:list') {
      await this.botApi.answerCallbackQuery(query.id);
      if (!(await this.isAdmin(telegramId))) {
        return;
      }
      await this.showAdminSupportInbox(chatId);
      return;
    }

    if (data.startsWith('admin:support:open:')) {
      await this.botApi.answerCallbackQuery(query.id);
      if (!(await this.isAdmin(telegramId))) {
        return;
      }
      const conversationId = data.slice('admin:support:open:'.length);
      await this.showAdminConversationDetail(chatId, conversationId);
      return;
    }

    if (data.startsWith('admin:support:reply:')) {
      await this.botApi.answerCallbackQuery(query.id);
      if (!(await this.isAdmin(telegramId))) {
        return;
      }
      const conversationId = data.slice('admin:support:reply:'.length);
      const conversation = await this.supportConversation.getConversationHistory(conversationId);
      if (!conversation) {
        await this.botApi.sendPlainMessage(chatId, msgs.adminSupportEmpty);
        return;
      }
      await this.sessionService.set(telegramId, BOT_FLOW.ADMIN_SUPPORT_REPLY, 'active', {
        conversationId,
        targetTelegramAccountId: conversation.telegramAccount.id,
        targetChatId: conversation.telegramAccount.telegramId.toString(),
        targetTelegramUserId: conversation.telegramAccount.telegramId.toString(),
      } satisfies AdminSupportReplyPayload);
      const adminMsgs = getTelegramI18n(TelegramLanguage.RU);
      await this.botApi.sendMessage(chatId, adminMsgs.adminSupportReplyPrompt, {
        inline_keyboard: [
          [{ text: adminMsgs.adminSupportReplyCancel, callback_data: `admin:support:open:${conversationId}` }],
        ],
      });
      return;
    }

    if (data.startsWith('admin:support:close:')) {
      await this.botApi.answerCallbackQuery(query.id);
      if (!(await this.isAdmin(telegramId))) {
        return;
      }
      const conversationId = data.slice('admin:support:close:'.length);
      await this.supportConversation.closeConversation(conversationId);
      await this.botApi.sendPlainMessage(chatId, msgs.adminSupportClosed);
      return;
    }

    if (data === CB.ACTION_INSTRUCTION) {
      await this.botApi.answerCallbackQuery(query.id);
      await this.showInstruction(resolved, chatId);
      return;
    }

    if (data === CB.ACTION_SUPPORT) {
      await this.botApi.answerCallbackQuery(query.id);
      await this.showSupportEntry(resolved, chatId, telegramId);
      return;
    }

    if (data === 'admin:create_license') {
      await this.botApi.answerCallbackQuery(query.id);
      if (!(await this.isAdmin(telegramId))) {
        return;
      }
      const adminMsgs = getTelegramI18n(TelegramLanguage.RU);
      await this.sessionService.set(telegramId, BOT_FLOW.ADMIN_CREATE_LICENSE, 'plan', {});
      await this.botApi.sendMessage(chatId, adminMsgs.adminCreateLicenseTitle, {
        inline_keyboard: [
          [{ text: 'Standard', callback_data: 'admin:lic:create:plan:STANDARD' }],
          [{ text: adminMsgs.linkCancelButton, callback_data: CB.ACTION_MAIN_MENU }],
        ],
      });
      return;
    }

    if (data.startsWith('admin:lic:create:plan:')) {
      await this.botApi.answerCallbackQuery(query.id);
      if (!(await this.isAdmin(telegramId))) {
        return;
      }
      const planCode = data.slice('admin:lic:create:plan:'.length);
      await this.sessionService.set(telegramId, BOT_FLOW.ADMIN_CREATE_LICENSE, 'duration', { planCode });
      const adminMsgs = getTelegramI18n(TelegramLanguage.RU);
      await this.botApi.sendMessage(chatId, adminMsgs.chooseDuration('Standard'), {
        inline_keyboard: [
          [{ text: '1 месяц', callback_data: 'admin:lic:create:dur:MONTHLY' }],
          [{ text: '1 год', callback_data: 'admin:lic:create:dur:YEARLY' }],
          [{ text: adminMsgs.linkCancelButton, callback_data: CB.ACTION_MAIN_MENU }],
        ],
      });
      return;
    }

    if (data.startsWith('admin:lic:create:dur:')) {
      await this.botApi.answerCallbackQuery(query.id);
      if (!(await this.isAdmin(telegramId))) {
        return;
      }
      const billingPeriod = data.slice('admin:lic:create:dur:'.length);
      const session = await this.sessionService.get<AdminCreateLicensePayload>(
        telegramId,
        BOT_FLOW.ADMIN_CREATE_LICENSE,
      );
      await this.sessionService.set(telegramId, BOT_FLOW.ADMIN_CREATE_LICENSE, 'confirm', {
        planCode: session?.planCode ?? PlanCode.STANDARD,
        billingPeriod,
      });
      const adminMsgs = getTelegramI18n(TelegramLanguage.RU);
      const periodLabel = billingPeriod === 'YEARLY' ? '1 год' : '1 месяц';
      await this.botApi.sendMessage(
        chatId,
        adminMsgs.adminCreateLicenseConfirm(session?.planCode ?? 'Standard', periodLabel),
        {
          inline_keyboard: [
            [{ text: '✅ Создать', callback_data: 'admin:lic:create:confirm' }],
            [{ text: adminMsgs.linkCancelButton, callback_data: CB.ACTION_MAIN_MENU }],
          ],
        },
      );
      return;
    }

    if (data === 'admin:lic:create:confirm') {
      await this.botApi.answerCallbackQuery(query.id);
      if (!(await this.isAdmin(telegramId))) {
        return;
      }
      const session = await this.sessionService.get<AdminCreateLicensePayload>(
        telegramId,
        BOT_FLOW.ADMIN_CREATE_LICENSE,
      );
      const planCode = parsePlanCode(session?.planCode ?? PlanCode.STANDARD);
      const billingPeriod =
        session?.billingPeriod === 'YEARLY' ? BillingPeriod.YEARLY : BillingPeriod.MONTHLY;
      if (!planCode) {
        return;
      }
      const plan = await this.prisma.plan.findUnique({ where: { code: planCode } });
      if (!plan) {
        return;
      }
      const issued = await this.licenseIssuance.issueLicense({
        planId: plan.id,
        issueSource: LicenseIssueSource.ADMIN_MANUAL,
        billingPeriod,
        eventReason: 'telegram_admin_manual_issue',
        eventMetadata: { adminTelegramId: telegramId.toString() },
        activateNow: true,
      });
      await this.clearFlow(telegramId, BOT_FLOW.ADMIN_CREATE_LICENSE);
      const adminMsgs = getTelegramI18n(TelegramLanguage.RU);
      const expires = formatDateLocalized(issued.expiresAt, 'RU');
      await this.botApi.sendMessage(
        chatId,
        adminMsgs.adminCreateLicenseSuccess(plan.name, expires, issued.licenseKey),
        {
          inline_keyboard: [
            [{ text: adminMsgs.adminCopyKeyButton, copy_text: { text: issued.licenseKey } }],
            [{ text: adminMsgs.adminMenuLicenses, callback_data: 'admin:licenses' }],
          ],
        },
      );
      return;
    }

    if (data === 'admin:orders') {
      await this.botApi.answerCallbackQuery(query.id);
      if (await this.isAdmin(telegramId)) {
        await this.showPendingOrders(chatId);
      }
      return;
    }

    if (data.startsWith('licenses:page:')) {
      const page = Number.parseInt(data.slice('licenses:page:'.length), 10);
      await this.botApi.answerCallbackQuery(query.id);
      await this.showMyLicenses(resolved, chatId, Number.isFinite(page) ? page : 0);
      return;
    }

    if (data.startsWith('link:confirm:')) {
      const token = data.slice('link:confirm:'.length);
      await this.botApi.answerCallbackQuery(query.id);
      try {
        const result = await this.telegramLicenseLink.confirmLink(
          token,
          resolved.telegramAccountId,
          telegramId,
        );
        await this.sendUserMessage(
          chatId,
          resolved,
          result.alreadyLinked ? msgs.linkAlreadyLinked : msgs.linkSuccess,
        );
      } catch {
        await this.sendUserMessage(chatId, resolved, msgs.linkHolderConflict);
      }
      return;
    }

    if (data.startsWith('link:cancel:')) {
      await this.botApi.answerCallbackQuery(query.id);
      await this.sendUserMessage(chatId, resolved, msgs.linkCancelButton);
      return;
    }

    if (data.startsWith('repl:confirm:')) {
      const token = data.slice('repl:confirm:'.length);
      await this.botApi.answerCallbackQuery(query.id);
      try {
        await this.deviceReplacement.confirmReplacement(token, resolved.telegramAccountId);
        await this.sendUserMessage(chatId, resolved, msgs.replacementSuccess);
      } catch {
        await this.sendUserMessage(chatId, resolved, msgs.linkHolderConflict);
      }
      return;
    }

    if (data.startsWith('repl:cancel:')) {
      await this.botApi.answerCallbackQuery(query.id);
      return;
    }

    if (data.startsWith('licdev:')) {
      const licenseId = data.slice('licdev:'.length);
      await this.botApi.answerCallbackQuery(query.id);
      await this.showLicenseDevices(resolved, chatId, licenseId);
      return;
    }

    if (data.startsWith('licrev:')) {
      const parts = data.slice('licrev:'.length).split(':');
      const licenseId = parts[0];
      const deviceId = parts[1];
      if (licenseId && deviceId) {
        await this.botApi.answerCallbackQuery(query.id);
        try {
          const result = await this.telegramLicenseLink.revokeDeviceAsHolder(
            resolved.telegramAccountId,
            licenseId,
            deviceId,
          );
          await this.sendUserMessage(
            chatId,
            resolved,
            msgs.deviceRevokedUsage(
              result.devicesUsedBefore,
              result.deviceLimit,
              result.devicesUsedAfter,
            ),
          );
        } catch {
          await this.sendUserMessage(chatId, resolved, msgs.adminUnauthorized);
        }
      }
      return;
    }

    if (data === CB.ACTION_BACK_PLAN) {
      await this.botApi.answerCallbackQuery(query.id);
      const session = await this.sessionService.getSession(telegramId);
      const planCodeRaw = session?.payload?.planCode;
      if (
        session?.flow === 'purchase' &&
        planCodeRaw === PlanCode.STANDARD &&
        session.step === 'duration'
      ) {
        await this.showStandardTariffCard(resolved, chatId, telegramId);
        return;
      }
      await this.sessionService.clear(telegramId);
      await this.showBuyFlow(resolved, chatId, query.from.first_name, telegramId);
      return;
    }

    if (data === CB.ACTION_BACK_DURATION) {
      await this.botApi.answerCallbackQuery(query.id);
      const session = await this.sessionService.get<{ planCode?: string }>(telegramId, 'purchase');
      if (session?.planCode) {
        const planCode = parsePlanCode(session.planCode);
        if (planCode) {
          const plans = await this.paymentConfigService.listPurchaseAvailablePlans();
          const plan = plans.find((p) => p.code === planCode);
          const planName = plan ? this.planDisplayName(plan, resolved) : planCode;
          await this.botApi.sendMessage(
            chatId,
            msgs.chooseDuration(planName),
            await this.durationSelectionKeyboard(resolved, planCode),
          );
          return;
        }
      }
      await this.showBuyFlow(resolved, chatId, query.from.first_name, telegramId);
      return;
    }

    if (data === CB.STANDARD_BUY_CONFIRM) {
      const available = await this.paymentConfigService.isPlanAvailableForPurchase(PlanCode.STANDARD);
      if (!available) {
        await this.botApi.answerCallbackQuery(query.id, msgs.planUnavailable);
        await this.sendUserMessage(chatId, resolved, msgs.planUnavailable);
        return;
      }
      await this.botApi.answerCallbackQuery(query.id);
      await this.showPlanDurationSelection(resolved, chatId, telegramId, PlanCode.STANDARD);
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

      if (planCode === PlanCode.STANDARD) {
        await this.botApi.answerCallbackQuery(query.id);
        await this.showStandardTariffCard(resolved, chatId, telegramId);
        return;
      }

      await this.botApi.answerCallbackQuery(query.id);
      await this.showPlanDurationSelection(resolved, chatId, telegramId, planCode);
      return;
    }

    const durationSelection = parseDurationCallback(data);
    if (durationSelection) {
      try {
        const periodAvailable = await this.paymentConfigService.isPlanPeriodAvailableForPurchase(
          durationSelection.planCode,
          durationSelection.billingPeriod as BillingPeriod,
        );
        if (!periodAvailable) {
          const planAvailable = await this.paymentConfigService.isPlanAvailableForPurchase(
            durationSelection.planCode,
          );
          const message = planAvailable ? msgs.durationUnavailable : msgs.planUnavailable;
          await this.sendUserMessage(chatId, resolved, message);
          await this.botApi.answerCallbackQuery(query.id, message);
          return;
        }
        await this.startOrderFlow(
          resolved,
          chatId,
          durationSelection.planCode,
          durationSelection.billingPeriod as BillingPeriod,
        );
      } catch {
        await this.sendUserMessage(chatId, resolved, msgs.durationUnavailable);
      }
      await this.botApi.answerCallbackQuery(query.id);
      return;
    }

    if (data === CB.ACTION_LANGUAGE) {
      await this.botApi.sendMessage(chatId, msgs.languageSelect, languageKeyboard(msgs));
      await this.botApi.answerCallbackQuery(query.id);
      return;
    }

    if (data === CB.ACTION_RETRY || data === CB.ACTION_GET_KEY) {
      await this.showBuyFlow(resolved, chatId, undefined, telegramId);
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
      await this.showMyLicenses(resolved, chatId, 0);
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
      await this.sendUserMessage(chatId, resolved, `${summary}\n\n${text}`, navRow(msgs, CB.ACTION_BACK_DURATION));
      return;
    }

    const keyboard: InlineKeyboardMarkup = {
      inline_keyboard: [
        ...methods.map((method) => [
          { text: method.name, callback_data: CB.paymentMethod(method.id) },
        ]),
        [{ text: msgs.menuBack, callback_data: CB.ACTION_BACK_DURATION }],
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

    const adminIds = await this.adminTelegramAuthService.listActiveAdminTelegramIds();
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

    if (!(await this.isAdmin(telegramId))) {
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
            await this.botApi.removeReplyKeyboard(userChatId);
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
        await this.botApi.sendMessage(userChatId, userMsgs.paymentRejected, mainMenuOnlyKeyboard(userMsgs));
        await this.botApi.removeReplyKeyboard(userChatId);
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

    rows.push([{ text: msgs.replyMainMenu, callback_data: CB.ACTION_MAIN_MENU }]);

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

    rows.push([{ text: msgs.menuBack, callback_data: CB.ACTION_BACK_PLAN }]);
    rows.push([{ text: msgs.replyMainMenu, callback_data: CB.ACTION_MAIN_MENU }]);

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

  private async handleAndroidDeepLink(
    kind: 'android_license' | 'android_support',
    telegramId: bigint,
    chatId: bigint,
    username?: string,
    firstName?: string,
  ): Promise<void> {
    const resolved = await this.telegramAccountService.resolveTelegramUser({
      telegramId,
      chatId,
      username,
      firstName,
    });

    if (
      !(await this.requireLanguageOrPrompt(resolved, chatId, telegramId, {
        kind: 'android',
        androidKind: kind,
      }))
    ) {
      return;
    }

    if (kind === 'android_support') {
      await this.showSupportEntry(resolved, chatId, telegramId);
      return;
    }

    await this.showBuyFlow(resolved, chatId, firstName, telegramId);
  }

  private async handleTelegramAuthStart(
    token: string,
    telegramId: bigint,
    chatId: bigint,
    username?: string,
    firstName?: string,
  ): Promise<void> {
    const resolved = await this.telegramAccountService.resolveTelegramUser({
      telegramId,
      chatId,
      username,
      firstName,
    });

    if (
      !(await this.requireLanguageOrPrompt(resolved, chatId, telegramId, {
        kind: 'auth',
        authToken: token,
      }))
    ) {
      return;
    }

    const msgs = this.i18n(resolved);

    const telegramAccount = await this.prisma.telegramAccount.findUnique({
      where: { userId: resolved.userId },
    });

    if (!telegramAccount) {
      await this.sendUserMessage(chatId, resolved, msgs.linkExpired);
      return;
    }

    try {
      await this.telegramAuthService.bindTelegramAndIssueOtp(
        token,
        telegramAccount.id,
        telegramId,
        async (otp, purpose) => {
          let text = msgs.telegramAuthOtp(otp);
          if (purpose === TelegramAuthPurpose.RECOVERY) {
            text = msgs.telegramAuthOtpRecovery(otp);
          } else if (purpose === TelegramAuthPurpose.LINK_ACCOUNT) {
            text = msgs.telegramAuthOtpLink(otp);
          }
          await this.botApi.sendMessage(
            chatId,
            text,
            copyCodeButton(msgs.telegramAuthCopyCode, otp),
            { parseMode: 'none' },
          );
        },
      );
    } catch (error) {
      let code: string | undefined;
      if (error instanceof HttpException) {
        const response = error.getResponse();
        if (typeof response === 'object' && response !== null && 'code' in response) {
          code = String((response as { code?: string }).code);
        }
      }

      if (code === 'AUTH_CHALLENGE_USED') {
        await this.sendUserMessage(chatId, resolved, msgs.telegramAuthChallengeUsed);
        return;
      }

      if (code === 'AUTH_CHALLENGE_EXPIRED' || code === 'AUTH_CHALLENGE_INVALID') {
        await this.sendUserMessage(chatId, resolved, msgs.telegramAuthChallengeExpired);
        return;
      }

      await this.sendUserMessage(chatId, resolved, msgs.linkExpired);
    }
  }

  private async presentLicenseLinkPrompt(
    token: string,
    telegramId: bigint,
    chatId: bigint,
    username?: string,
    firstName?: string,
  ): Promise<void> {
    const resolved = await this.telegramAccountService.resolveTelegramUser({
      telegramId,
      chatId,
      username,
      firstName,
    });

    if (
      !(await this.requireLanguageOrPrompt(resolved, chatId, telegramId, {
        kind: 'license_link',
        linkToken: token,
      }))
    ) {
      return;
    }

    const msgs = this.i18n(resolved);

    try {
      const preview = await this.telegramLicenseLink.getChallengePreview(token);
      const expires = preview.expiresAt
        ? formatDateLocalized(preview.expiresAt, this.langCode(resolved))
        : '—';
      const deviceLabel =
        [preview.device?.manufacturer, preview.device?.model, preview.device?.deviceName]
          .filter(Boolean)
          .join(' ') || 'Android';
      const text = msgs.linkConfirmPrompt(
        preview.plan?.name ?? '—',
        expires,
        this.maskKeyPrefix(preview.keyPrefix),
        deviceLabel,
      );
      await this.botApi.sendMessage(chatId, text, {
        inline_keyboard: [
          [{ text: msgs.linkConfirmButton, callback_data: CB.linkConfirm(token) }],
          [{ text: msgs.linkCancelButton, callback_data: CB.linkCancel(token) }],
        ],
      });
    } catch {
      await this.sendUserMessage(chatId, resolved, msgs.linkExpired);
    }
  }

  private async presentReplacementPrompt(
    token: string,
    telegramId: bigint,
    chatId: bigint,
    username?: string,
    firstName?: string,
  ): Promise<void> {
    const resolved = await this.telegramAccountService.resolveTelegramUser({
      telegramId,
      chatId,
      username,
      firstName,
    });

    if (
      !(await this.requireLanguageOrPrompt(resolved, chatId, telegramId, {
        kind: 'replacement',
        replacementToken: token,
      }))
    ) {
      return;
    }

    const msgs = this.i18n(resolved);

    try {
      const preview = await this.deviceReplacement.getChallengePreview(token);
      const oldLabel =
        [preview.oldDevice?.deviceManufacturer, preview.oldDevice?.deviceModel, preview.oldDevice?.deviceName]
          .filter(Boolean)
          .join(' ') || '—';
      const newLabel =
        [preview.newDevice?.deviceManufacturer, preview.newDevice?.deviceModel, preview.newDevice?.deviceName]
          .filter(Boolean)
          .join(' ') || '—';
      await this.botApi.sendMessage(chatId, msgs.replacementConfirmPrompt(oldLabel, newLabel), {
        inline_keyboard: [
          [{ text: msgs.replacementConfirmButton, callback_data: CB.replConfirm(token) }],
          [{ text: msgs.linkCancelButton, callback_data: CB.replCancel(token) }],
        ],
      });
    } catch {
      await this.sendUserMessage(chatId, resolved, msgs.linkExpired);
    }
  }

  private async showLicenseDevices(
    resolved: ResolvedTelegramUser,
    chatId: bigint,
    licenseId: string,
  ): Promise<void> {
    const msgs = this.i18n(resolved);
    const license = await this.prisma.license.findUnique({
      where: { id: licenseId },
      include: {
        activations: {
          where: { revokedAt: null, device: { revokedAt: null } },
          include: { device: true },
        },
      },
    });

    if (!license || license.holderTelegramAccountId !== resolved.telegramAccountId) {
      await this.sendUserMessage(chatId, resolved, msgs.adminUnauthorized);
      return;
    }

    const lines = license.activations.map((a) => {
      const d = a.device;
      const label = [d.deviceManufacturer, d.deviceModel, d.deviceName].filter(Boolean).join(' ') || d.installationId.slice(0, 8);
      return `• ${label}\n  ${d.appVersion ?? '—'} | ${formatDateLocalized(a.createdAt, this.langCode(resolved))}`;
    });

    const rows: InlineKeyboardMarkup['inline_keyboard'] = license.activations.map((a) => [
      {
        text: `${msgs.revokeDeviceButton}: ${a.device.deviceName ?? a.device.deviceModel ?? 'Device'}`,
        callback_data: CB.revokeDevice(licenseId, a.deviceId),
      },
    ]);
    rows.push([{ text: msgs.replyMainMenu, callback_data: CB.ACTION_MAIN_MENU }]);

    await this.botApi.sendMessage(
      chatId,
      `${msgs.licenseDevicesTitle}\n\n${lines.join('\n\n') || '—'}`,
      { inline_keyboard: rows },
    );
  }
}

