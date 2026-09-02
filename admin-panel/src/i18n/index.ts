export {
  labelOrderStatus,
  labelLicenseStatus,
  labelUserStatus,
  labelBillingPeriod,
  labelSystemHealth,
  labelServiceStatus,
  labelDeviceActive,
  labelAdminActive,
  labelPlanPurchaseAvailability,
  labelTelegramConnected,
  labelPlanCode,
  labelPlan,
  labelPlatform,
  labelUserCategory,
  knownOrderStatuses,
  knownLicenseStatuses,
} from './status';
export { labelAuditAction, labelEntityType, formatAuditAction, knownAuditActions } from './audit';
export type { AuditActionPresentation } from './audit';
export { localizeError, formatApiError, knownErrorCodes } from './errors';
export { formatDateTime, formatDate, formatMoney, formatTelegramUser, labelRole } from './format';

import { ru, type RuStrings } from './ru';
import { tj } from './tj';

let activeLocale: 'ru' | 'tj' = 'ru';

export function setActiveLocale(locale: 'ru' | 'tj') {
  activeLocale = locale;
}

/** Типобезопасный доступ к строкам. */
export function t(): RuStrings {
  return activeLocale === 'tj' ? tj : ru;
}

export { ru, tj };
export type { RuStrings };
