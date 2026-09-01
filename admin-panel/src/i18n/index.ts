export { ru } from './ru';
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

import { ru } from './ru';

/** Типобезопасный доступ к строкам (единый источник правды). */
export function t(): typeof ru {
  return ru;
}
