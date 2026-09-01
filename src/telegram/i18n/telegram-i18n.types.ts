export interface TelegramI18n {
  languageSelect: string;
  languageButtonTj: string;
  languageButtonRu: string;
  languageChanged: string;
  welcomeNoLicense: (name?: string) => string;
  welcomeActiveLicense: (expiresAt: string) => string;
  choosePlan: string;
  planStandardLabel: string;
  planProLabel: string;
  chooseDuration: (planName: string) => string;
  duration30Days: (price: string) => string;
  duration365Days: (price: string) => string;
  durationUnavailable: string;
  planStandard: (price: string, days: number) => string;
  planPro: (price: string, days: number) => string;
  paymentInstructions: (
    planName: string,
    amount: string,
    days: number,
    card: string,
    recipient: string,
    extra: string,
  ) => string;
  askReceipt: string;
  receiptReceived: string;
  noAwaitingOrder: string;
  paymentApproved: (key: string, days: number, expiresAt: string) => string;
  paymentRejected: string;
  subscriptionInfo: (plan: string, expiresAt: string, prefix: string) => string;
  help: string;
  supportRelayed: string;
  supportRelayUnavailable: string;
  supportAttachmentRelayed: string;
  unsupportedAttachment: string;
  menuLanguage: string;
  menuMyKey: string;
  menuMySub: string;
  menuHelp: string;
  menuGetKey: string;
  menuRetry: string;
  adminUnauthorized: string;
  adminApprovedDuplicate: string;
  adminRejectedDuplicate: string;
}
