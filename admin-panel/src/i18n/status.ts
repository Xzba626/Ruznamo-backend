const orderStatusLabels: Record<string, string> = {
  PENDING: 'Ожидает оплаты',
  RECEIPT_SUBMITTED: 'Чек получен',
  UNDER_REVIEW: 'На проверке',
  APPROVED: 'Подтверждено',
  REJECTED: 'Отклонено',
  COMPLETED: 'Завершено',
  CANCELLED: 'Отменено',
};

const licenseStatusLabels: Record<string, string> = {
  PENDING: 'Ожидает активации',
  ACTIVE: 'Активна',
  EXPIRED: 'Истекла',
  REVOKED: 'Отозвана',
  SUSPENDED: 'Приостановлена',
};

const userStatusLabels: Record<string, string> = {
  ACTIVE: 'Активен',
  SUSPENDED: 'Приостановлен',
  DELETED: 'Удалён',
};

const receiptStatusLabels: Record<string, string> = {
  PENDING: 'Ожидает проверки',
  APPROVED: 'Подтверждён',
  REJECTED: 'Отклонён',
};

const trialStatusLabels: Record<string, string> = {
  ACTIVE: 'Активен',
  EXPIRED: 'Истёк',
  REVOKED: 'Отозван',
};

const billingPeriodLabels: Record<string, string> = {
  MONTHLY: '1 месяц',
  YEARLY: '1 год',
};

const systemHealthLabels: Record<string, string> = {
  healthy: 'Работает',
  up: 'Доступна',
  down: 'Недоступна',
  ready: 'Готова',
  not_ready: 'Не готова',
  ok: 'OK',
  development: 'Разработка',
  production: 'Продакшен',
  test: 'Тест',
  staging: 'Стейджинг',
};

const userCategoryLabels: Record<string, string> = {
  TEACHER: 'Учитель',
  LECTURER: 'Преподаватель',
  TUTOR: 'Репетитор',
  TRAINER: 'Тренер',
  EMPLOYEE: 'Сотрудник',
  STUDENT: 'Студент',
  PERSONAL: 'Личный',
};

const planCodeLabels: Record<string, string> = {
  STANDARD: 'Стандарт',
  PRO: 'Pro',
  PRO_PLUS: 'Pro Plus',
};

export function labelOrderStatus(status: string): string {
  return orderStatusLabels[status] ?? status;
}

export function labelLicenseStatus(status: string): string {
  return licenseStatusLabels[status] ?? status;
}

export function labelUserStatus(status: string): string {
  return userStatusLabels[status] ?? status;
}

export function labelReceiptStatus(status: string): string {
  return receiptStatusLabels[status] ?? status;
}

export function labelTrialStatus(status: string): string {
  return trialStatusLabels[status] ?? status;
}

export function labelBillingPeriod(period: string): string {
  return billingPeriodLabels[period] ?? period;
}

export function labelSystemHealth(value: string): string {
  return systemHealthLabels[value] ?? value;
}

export function labelUserCategory(category: string): string {
  return userCategoryLabels[category] ?? category;
}

export function labelPlanCode(code: string): string {
  return planCodeLabels[code] ?? code;
}

export function labelPlatform(platform: string): string {
  const map: Record<string, string> = {
    ANDROID: 'Android',
    IOS: 'iOS',
    WEB: 'Web',
  };
  return map[platform] ?? platform;
}

export function labelDeviceActive(isActive: boolean): string {
  return isActive ? 'Активно' : 'Отозвано';
}

export function labelAdminActive(isActive: boolean): string {
  return isActive ? 'Активен' : 'Неактивен';
}

export function labelTelegramConnected(isVerified: boolean): string {
  return isVerified ? 'Подключён' : 'Не подключён';
}

/** Для тестов: все известные статусы должны иметь русские метки. */
export const knownOrderStatuses = Object.keys(orderStatusLabels);
export const knownLicenseStatuses = Object.keys(licenseStatusLabels);
