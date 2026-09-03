/**
 * Single inventory of callback_data patterns emitted by production UI.
 * Used by dead-callback / orphan-handler regression tests.
 */

export type CallbackRole = 'user' | 'admin' | 'any';

export interface CallbackInventoryEntry {
  /** Prefix or exact match */
  pattern: string;
  kind: 'exact' | 'prefix';
  role: CallbackRole;
  emitsFrom: string;
  handlerHint: string;
}

export const CALLBACK_INVENTORY: CallbackInventoryEntry[] = [
  { pattern: 'lang:tj', kind: 'exact', role: 'any', emitsFrom: 'language', handlerHint: 'setLanguage' },
  { pattern: 'lang:ru', kind: 'exact', role: 'any', emitsFrom: 'language', handlerHint: 'setLanguage' },
  { pattern: 'action:main_menu', kind: 'exact', role: 'any', emitsFrom: 'nav', handlerHint: 'sendRootMenu' },
  { pattern: 'action:nav_back', kind: 'exact', role: 'any', emitsFrom: 'nav', handlerHint: 'navBack' },
  { pattern: 'action:get_key', kind: 'exact', role: 'user', emitsFrom: 'userRoot', handlerHint: 'showBuyFlow' },
  { pattern: 'action:my_sub', kind: 'exact', role: 'user', emitsFrom: 'userRoot', handlerHint: 'showMyLicenses' },
  { pattern: 'action:recover', kind: 'exact', role: 'user', emitsFrom: 'userRoot', handlerHint: 'showRecover' },
  { pattern: 'action:language', kind: 'exact', role: 'any', emitsFrom: 'root', handlerHint: 'language' },
  { pattern: 'action:support', kind: 'exact', role: 'user', emitsFrom: 'userRoot', handlerHint: 'supportEntry' },
  { pattern: 'action:instruction', kind: 'exact', role: 'user', emitsFrom: 'userRoot', handlerHint: 'instruction' },
  { pattern: 'action:support_exit', kind: 'exact', role: 'user', emitsFrom: 'support', handlerHint: 'supportCloseConfirm' },
  { pattern: 'action:support_close_confirm', kind: 'exact', role: 'user', emitsFrom: 'support', handlerHint: 'closeSupport' },
  { pattern: 'action:support_close_cancel', kind: 'exact', role: 'user', emitsFrom: 'support', handlerHint: 'resumeSupport' },
  { pattern: 'action:back_plan', kind: 'exact', role: 'user', emitsFrom: 'buy', handlerHint: 'backPlan' },
  { pattern: 'action:back_duration', kind: 'exact', role: 'user', emitsFrom: 'buy', handlerHint: 'backDuration' },
  { pattern: 'action:cancel_payment', kind: 'exact', role: 'user', emitsFrom: 'receipt', handlerHint: 'cancelPaymentConfirm' },
  { pattern: 'action:cancel_payment_yes', kind: 'exact', role: 'user', emitsFrom: 'receipt', handlerHint: 'cancelPayment' },
  { pattern: 'action:cancel_payment_no', kind: 'exact', role: 'user', emitsFrom: 'receipt', handlerHint: 'resumeReceipt' },
  { pattern: 'action:continue_pending', kind: 'exact', role: 'user', emitsFrom: 'buy', handlerHint: 'continuePending' },
  { pattern: 'action:new_purchase', kind: 'exact', role: 'user', emitsFrom: 'buy', handlerHint: 'newPurchase' },
  { pattern: 'support:cat:', kind: 'prefix', role: 'user', emitsFrom: 'support', handlerHint: 'activateSupport' },
  { pattern: 'instruct:', kind: 'prefix', role: 'user', emitsFrom: 'instruction', handlerHint: 'instructionArticle' },
  { pattern: 'plan:', kind: 'prefix', role: 'user', emitsFrom: 'buy', handlerHint: 'planSelect' },
  { pattern: 'duration:', kind: 'prefix', role: 'user', emitsFrom: 'buy', handlerHint: 'durationSelect' },
  { pattern: 'paymethod:', kind: 'prefix', role: 'user', emitsFrom: 'buy', handlerHint: 'paymentMethod' },
  { pattern: 'licenses:page:', kind: 'prefix', role: 'user', emitsFrom: 'licenses', handlerHint: 'licensesPage' },
  { pattern: 'lic:detail:', kind: 'prefix', role: 'user', emitsFrom: 'licenses', handlerHint: 'licenseDetail' },
  { pattern: 'licdev:', kind: 'prefix', role: 'user', emitsFrom: 'licenses', handlerHint: 'licenseDevices' },
  { pattern: 'licdevitem:', kind: 'prefix', role: 'user', emitsFrom: 'devices', handlerHint: 'deviceDetail' },
  { pattern: 'licrev:confirm:', kind: 'prefix', role: 'user', emitsFrom: 'devices', handlerHint: 'disconnectConfirm' },
  { pattern: 'licrev:do:', kind: 'prefix', role: 'user', emitsFrom: 'devices', handlerHint: 'disconnectDo' },
  { pattern: 'licrev:', kind: 'prefix', role: 'user', emitsFrom: 'devices', handlerHint: 'disconnectLegacyConfirm' },
  { pattern: 'link:confirm:', kind: 'prefix', role: 'user', emitsFrom: 'deeplink', handlerHint: 'linkConfirm' },
  { pattern: 'link:cancel:', kind: 'prefix', role: 'user', emitsFrom: 'deeplink', handlerHint: 'linkCancel' },
  { pattern: 'repl:confirm:', kind: 'prefix', role: 'user', emitsFrom: 'deeplink', handlerHint: 'replConfirm' },
  { pattern: 'repl:cancel:', kind: 'prefix', role: 'user', emitsFrom: 'deeplink', handlerHint: 'replCancel' },
  { pattern: 'payment:approve:', kind: 'prefix', role: 'admin', emitsFrom: 'orders', handlerHint: 'approve' },
  { pattern: 'payment:reject:', kind: 'prefix', role: 'admin', emitsFrom: 'orders', handlerHint: 'reject' },
  { pattern: 'admin:orders', kind: 'exact', role: 'admin', emitsFrom: 'adminRoot', handlerHint: 'orders' },
  { pattern: 'admin:licenses', kind: 'exact', role: 'admin', emitsFrom: 'adminRoot', handlerHint: 'adminLicenses' },
  { pattern: 'admin:lic:detail:', kind: 'prefix', role: 'admin', emitsFrom: 'adminLicenses', handlerHint: 'adminLicenseDetail' },
  { pattern: 'admin:lic:devices:', kind: 'prefix', role: 'admin', emitsFrom: 'adminLicenses', handlerHint: 'adminLicenseDevices' },
  { pattern: 'admin:lic:revoke:confirm:', kind: 'prefix', role: 'admin', emitsFrom: 'adminLicenses', handlerHint: 'revokeConfirm' },
  { pattern: 'admin:lic:revoke:do:', kind: 'prefix', role: 'admin', emitsFrom: 'adminLicenses', handlerHint: 'revokeDo' },
  { pattern: 'admin:lic:page:', kind: 'prefix', role: 'admin', emitsFrom: 'adminLicenses', handlerHint: 'adminLicensesPage' },
  { pattern: 'admin:create_license', kind: 'exact', role: 'admin', emitsFrom: 'adminRoot', handlerHint: 'createLicense' },
  { pattern: 'admin:lic:create:', kind: 'prefix', role: 'admin', emitsFrom: 'createLicense', handlerHint: 'createWizard' },
  { pattern: 'admin:support:', kind: 'prefix', role: 'admin', emitsFrom: 'adminSupport', handlerHint: 'adminSupport' },
  { pattern: 'admin:pm:', kind: 'prefix', role: 'admin', emitsFrom: 'requisites', handlerHint: 'paymentMethods' },
];

export function matchInventory(data: string): CallbackInventoryEntry | null {
  for (const entry of CALLBACK_INVENTORY) {
    if (entry.kind === 'exact' && data === entry.pattern) return entry;
    if (entry.kind === 'prefix' && data.startsWith(entry.pattern)) return entry;
  }
  return null;
}

export function isAdminCallback(data: string): boolean {
  if (data.startsWith('admin:')) return true;
  if (data.startsWith('payment:approve:') || data.startsWith('payment:reject:')) return true;
  if (data.startsWith('approve:') || data.startsWith('reject:')) return true;
  return false;
}
