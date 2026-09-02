export interface TelegramI18n {
  languageSelect: string;
  languageButtonTj: string;
  languageButtonRu: string;
  languageChanged: string;
  welcomeNoLicense: (name?: string) => string;
  welcomeActiveLicense: (expiresAt: string) => string;
  choosePlan: string;
  planUnavailable: string;
  purchaseUnavailable: string;
  planStandardLabel: string;
  planProLabel: string;
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
  paymentRejected: string;
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
}
