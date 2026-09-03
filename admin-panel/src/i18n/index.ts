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
  labelReleaseStatus,
  labelPlanCode,
  labelPlan,
  labelPlatform,
  labelUserCategory,
  knownOrderStatuses,
  knownLicenseStatuses,
  knownUserStatuses,
  knownReleaseStatuses,
} from './status';
export { labelAuditAction, labelEntityType, formatAuditAction, knownAuditActions } from './audit';
export type { AuditActionPresentation } from './audit';
export { localizeError, formatApiError, knownErrorCodes } from './errors';
export { formatDateTime, formatDate, formatMoney, formatTelegramUser, labelRole } from './format';
export { setActiveLocale, getActiveLocale } from './locale-state';
export type { AdminLocale } from './locale-state';

import { ru, type RuStrings } from './ru';
import { tj } from './tj';
import { getActiveLocale } from './locale-state';

/** Типобезопасный доступ к строкам. */
export function t(): RuStrings {
  return getActiveLocale() === 'tj' ? tj : ru;
}

export { ru, tj };
export type { RuStrings };
