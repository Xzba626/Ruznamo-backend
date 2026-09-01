export { ru } from './ru';
export {
  labelOrderStatus,
  labelLicenseStatus,
  labelUserStatus,
  labelBillingPeriod,
  labelSystemHealth,
  labelDeviceActive,
  labelAdminActive,
  labelTelegramConnected,
  labelPlanCode,
  labelPlatform,
  knownOrderStatuses,
  knownLicenseStatuses,
} from './status';
export { labelAuditAction, labelEntityType, knownAuditActions } from './audit';
export { localizeError, formatApiError, knownErrorCodes } from './errors';
export { formatDateTime, formatDate, formatMoney, formatTelegramUser, labelRole } from './format';

import { ru } from './ru';

/** Типобезопасный доступ к строкам (единый источник правды). */
export function t(): typeof ru {
  return ru;
}
