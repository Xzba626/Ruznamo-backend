export interface TelegramI18n {
  languageSelect: string;
  languageButtonTj: string;
  languageButtonRu: string;
  languageChanged: string;
  userStartWelcome: string;
  welcomeNoLicense: (name?: string) => string;
  welcomeActiveLicense: (expiresAt: string) => string;
  choosePlan: string;
  planUnavailable: string;
  purchaseUnavailable: string;
  planStandardLabel: string;
  planProLabel: string;
  standardTariffCard: () => string;
  standardDurationMonthButton: (price: string) => string;
  standardDurationYearButton: (price: string) => string;
  standardBuyButton: string;
  chooseDuration: (planName: string) => string;
  duration30Days: (price: string) => string;
  duration365Days: (price: string) => string;
  durationUnavailable: string;
  planStandard: (price: string, days: number) => string;
  planPro: (price: string, days: number) => string;
  paymentSummary: (planName: string, days: number, amount: string) => string;
  choosePaymentMethod: string;
  paymentInstructions: (
    methodName: string,
    planName: string,
    amount: string,
    days: number,
    paymentValue: string,
    recipient: string,
  ) => string;
  askReceipt: string;
  receiptReceived: string;
  noAwaitingOrder: string;
  paymentApproved: (planName: string, days: number, expiresAt: string, key: string) => string;
  /** @deprecated prefer paymentRejectedDetailed */
  paymentRejected: string;
  paymentRejectedDetailed: (
    orderShortId: string,
    planName: string,
    periodLabel: string,
    reason: string,
    guidance: string | null,
  ) => string;
  myLicensesTitle: string;
  subscriptionInfo: (plan: string, days: number, expiresAt: string, maskedKey: string) => string;
  licenseListItem: (
    plan: string,
    status: string,
    expiresAt: string,
    devicesUsed: number,
    deviceLimit: number,
    source: string,
    maskedKey: string,
  ) => string;
  noActiveLicense: string;
  instructionTitle: string;
  instructionBody: string;
  supportWelcome: string;
  supportCategoryPrompt: string;
  supportCategoryTechnical: string;
  supportCategoryLicense: string;
  supportCategoryPayment: string;
  supportCategoryDevice: string;
  supportCategoryOther: string;
  supportCategoryLabel: (category: string) => string;
  supportMessageSent: string;
  supportCloseConfirm: string;
  supportCloseConfirmYes: string;
  supportCloseConfirmNo: string;
  supportClosedFinal: string;
  supportExit: string;
  supportExited: string;
  supportDirectContact: string;
  supportPhoneLabel: (phone: string) => string;
  sourceTelegram: string;
  sourceManual: string;
  sourceUnknown: string;
  help: string;
  supportRelayed: string;
  supportRelayUnavailable: string;
  supportAttachmentRelayed: string;
  supportReplyFromAdmin: (body: string) => string;
  adminSupportReplyTargetUnknown: string;
  unsupportedAttachment: string;
  replyBuyLicense: string;
  replyMyLicenses: string;
  replySupport: string;
  replyLanguage: string;
  replyMainMenu: string;
  menuLanguage: string;
  menuMyKey: string;
  menuMySub: string;
  menuHelp: string;
  menuGetKey: string;
  menuRetry: string;
  menuBack: string;
  adminWelcome: string;
  adminUnauthorized: string;
  adminApprovedDuplicate: string;
  adminRejectedDuplicate: string;
  linkConfirmPrompt: (plan: string, expiresAt: string, maskedKey: string, deviceLabel: string) => string;
  linkConfirmButton: string;
  linkCancelButton: string;
  linkSuccess: string;
  linkAlreadyLinked: string;
  linkHolderConflict: string;
  linkExpired: string;
  replacementConfirmPrompt: (oldDevice: string, newDevice: string) => string;
  replacementConfirmButton: string;
  replacementSuccess: string;
  licenseDevicesTitle: string;
  revokeDeviceButton: string;
  revokeDeviceConfirm: string;
  deviceRevoked: string;
  deviceRevokedUsage: (before: number, max: number, after: number) => string;
  licenseControlSection: string;
  telegramAuthOtp: (code: string) => string;
  telegramAuthChallengeUsed: string;
  telegramAuthChallengeExpired: string;
  telegramAuthNoLicenses: string;
  mainMenuTitle: string;
  replyRecoverAccess: string;
  recoverAccessBody: string;
  replyAdminMenu: string;
  stopAcknowledged: string;
  adminMenuTitle: string;
  adminMenuOrders: string;
  adminMenuRequisites: string;
  adminMenuSupport: string;
  adminMenuLicenses: string;
  adminMenuCreateLicense: string;
  adminSupportInboxTitle: string;
  adminSupportEmpty: string;
  adminSupportConversationTitle: (user: string) => string;
  adminSupportReplyButton: string;
  adminSupportReplySent: string;
  adminSupportReplyCancel: string;
  adminSupportBackToList: string;
  adminSupportDetailTitle: (ticket: string) => string;
  adminSupportInboxCount: (count: number) => string;
  adminSupportInboxRow: (ticket: string, user: string, category: string, preview: string) => string;
  adminCreateLicenseTitle: string;
  adminCreateLicenseConfirm: (plan: string, period: string) => string;
  adminCreateLicenseSuccess: (plan: string, expiresAt: string, key: string) => string;
  adminCopyKeyButton: string;
  telegramAuthOtpRecovery: (code: string) => string;
  telegramAuthOtpLink: (code: string) => string;
  telegramAuthCopyCode: string;
  invalidInputUseButtons: string;
  paymentAwaitingReceiptHint: string;
  adminRootTitle: string;
  adminSupportReplyPrompt: string;
  adminSupportClosed: string;
  staleCallback: string;
  buttonUnavailable: string;
  pendingOrderExists: string;
  continuePendingPayment: string;
  cancelPendingOrder: string;
  newPurchase: string;
  sendReceiptButton: string;
  cancelPaymentButton: string;
  cancelPaymentConfirm: string;
  cancelPaymentYes: string;
  cancelPaymentNo: string;
  paymentCancelled: string;
  receiptSentShort: string;
  myOrderButton: string;
  disconnectDeviceTitle: (device: string, plan: string) => string;
  disconnectDeviceBody: string;
  disconnectConfirmYes: string;
  disconnectCancel: string;
  backToDevices: string;
  showKeyButton: string;
  licenseDevicesButton: string;
  instructionGettingStarted: string;
  instructionLicense: string;
  instructionSchedule: string;
  instructionDevices: string;
  instructionRecovery: string;
  instructionSupport: string;
  instructionArticleGettingStarted: string;
  instructionArticleLicense: string;
  instructionArticleSchedule: string;
  instructionArticleDevices: string;
  instructionArticleRecovery: string;
  instructionArticleSupport: string;
  telegramAuthOtpLogin: (code: string) => string;
  chooseActionButtons: string;
  adminChooseAction: string;
  adminPanelButton: string;
  orderCancelledShort: string;
  retryButton: string;
  temporaryError: string;
  dataUnavailable: string;
  operationUnavailable: string;
  rateLimited: string;
  operationExpired: string;
}
