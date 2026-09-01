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

const UNKNOWN_STATUS_LABEL = 'Неизвестный статус';

const planCodeLabels: Record<string, string> = {
  STANDARD: 'Стандарт',
  PRO: 'Про',
  PRO_PLUS: 'Про+',
};

export function labelOrderStatus(status: string): string {
  return orderStatusLabels[status] ?? UNKNOWN_STATUS_LABEL;
}

export function labelLicenseStatus(status: string): string {
  return licenseStatusLabels[status] ?? UNKNOWN_STATUS_LABEL;
}

export function labelUserStatus(status: string): string {
  return userStatusLabels[status] ?? UNKNOWN_STATUS_LABEL;
}

export function labelReceiptStatus(status: string): string {
  return receiptStatusLabels[status] ?? UNKNOWN_STATUS_LABEL;
}

export function labelTrialStatus(status: string): string {
  return trialStatusLabels[status] ?? UNKNOWN_STATUS_LABEL;
}

export function labelBillingPeriod(period: string): string {
  return billingPeriodLabels[period] ?? UNKNOWN_STATUS_LABEL;
}

export function labelSystemHealth(value: string): string {
  return systemHealthLabels[value] ?? value;
}

const serviceStatusLabels: Record<string, string> = {
  healthy: 'Работает',
  warning: 'Есть предупреждение',
  error: 'Недоступно',
  not_configured: 'Не настроено',
  info: 'Информация',
};

export function labelServiceStatus(status: string): string {
  return serviceStatusLabels[status] ?? status;
}

export function labelUserCategory(category: string): string {
  return userCategoryLabels[category] ?? UNKNOWN_STATUS_LABEL;
}

export function labelPlanCode(code: string): string {
  return planCodeLabels[code] ?? UNKNOWN_STATUS_LABEL;
}

/** Отображаемое название тарифа для администратора (по коду, не по name из БД). */
export function labelPlan(plan: { code: string; name?: string }): string {
  return labelPlanCode(plan.code);
}

export function labelPlatform(platform: string): string {
  const map: Record<string, string> = {
    ANDROID: 'Android',
    IOS: 'iOS',
    WEB: 'Web',
  };
  return map[platform] ?? UNKNOWN_STATUS_LABEL;
}

export function labelDeviceActive(isActive: boolean): string {
  return isActive ? 'Активно' : 'Отозвано';
}

export function labelAdminActive(isActive: boolean): string {
  return isActive ? 'Активен' : 'Неактивен';
}

export function labelPlanPurchaseAvailability(isActive: boolean): string {
  return isActive ? 'Доступен для покупки' : 'Отключён';
}

export function labelTelegramConnected(isVerified: boolean): string {
  return isVerified ? 'Подключён' : 'Не подключён';
}

/** Для тестов: все известные статусы должны иметь русские метки. */
export const knownOrderStatuses = Object.keys(orderStatusLabels);
export const knownLicenseStatuses = Object.keys(licenseStatusLabels);
