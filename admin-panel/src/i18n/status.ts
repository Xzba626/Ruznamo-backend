import { getActiveLocale, type AdminLocale } from './locale-state';

type LocaleMap = Record<AdminLocale, Record<string, string>>;
type LocaleBool = Record<AdminLocale, { yes: string; no: string }>;

function pick(map: LocaleMap, key: string, fallback: string): string {
  const locale = getActiveLocale();
  return map[locale][key] ?? map.ru[key] ?? fallback;
}

function pickBool(map: LocaleBool, value: boolean): string {
  const locale = getActiveLocale();
  const entry = map[locale] ?? map.ru;
  return value ? entry.yes : entry.no;
}

const UNKNOWN: Record<AdminLocale, string> = {
  ru: 'Неизвестный статус',
  tj: 'Ҳолати номаълум',
};

const orderStatusLabels: LocaleMap = {
  ru: {
    PENDING: 'Ожидает оплаты',
    RECEIPT_SUBMITTED: 'Чек получен',
    UNDER_REVIEW: 'На проверке',
    APPROVED: 'Подтверждено',
    REJECTED: 'Отклонено',
    COMPLETED: 'Завершено',
    CANCELLED: 'Отменено',
  },
  tj: {
    PENDING: 'Интизори пардохт',
    RECEIPT_SUBMITTED: 'Чек гирифта шуд',
    UNDER_REVIEW: 'Дар баррасӣ',
    APPROVED: 'Тасдиқ шуд',
    REJECTED: 'Рад шуд',
    COMPLETED: 'Анҷом ёфт',
    CANCELLED: 'Бекор шуд',
  },
};

const licenseStatusLabels: LocaleMap = {
  ru: {
    PENDING: 'Ожидает активации',
    ACTIVE: 'Активна',
    EXPIRED: 'Истекла',
    REVOKED: 'Отозвана',
    SUSPENDED: 'Приостановлена',
  },
  tj: {
    PENDING: 'Интизори фаъолсозӣ',
    ACTIVE: 'Фаъол',
    EXPIRED: 'Мӯҳлаташ гузашт',
    REVOKED: 'Бозпас гирифта шуд',
    SUSPENDED: 'Мутаваққиф',
  },
};

const userStatusLabels: LocaleMap = {
  ru: {
    ACTIVE: 'Активен',
    SUSPENDED: 'Приостановлен',
    DELETED: 'Удалён',
  },
  tj: {
    ACTIVE: 'Фаъол',
    SUSPENDED: 'Мутаваққиф',
    DELETED: 'Нест карда шуд',
  },
};

const receiptStatusLabels: LocaleMap = {
  ru: {
    PENDING: 'Ожидает проверки',
    APPROVED: 'Подтверждён',
    REJECTED: 'Отклонён',
  },
  tj: {
    PENDING: 'Интизори санҷиш',
    APPROVED: 'Тасдиқ шуд',
    REJECTED: 'Рад шуд',
  },
};

const trialStatusLabels: LocaleMap = {
  ru: {
    ACTIVE: 'Активен',
    EXPIRED: 'Истёк',
    REVOKED: 'Отозван',
  },
  tj: {
    ACTIVE: 'Фаъол',
    EXPIRED: 'Мӯҳлаташ гузашт',
    REVOKED: 'Бозпас гирифта шуд',
  },
};

const billingPeriodLabels: LocaleMap = {
  ru: {
    MONTHLY: '1 месяц',
    YEARLY: '1 год',
  },
  tj: {
    MONTHLY: '1 моҳ',
    YEARLY: '1 сол',
  },
};

const systemHealthLabels: LocaleMap = {
  ru: {
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
  },
  tj: {
    healthy: 'Кор мекунад',
    up: 'Дастрас',
    down: 'Дастнорас',
    ready: 'Омода',
    not_ready: 'Омода нест',
    ok: 'OK',
    development: 'Таҳия',
    production: 'Production',
    test: 'Тест',
    staging: 'Staging',
  },
};

const userCategoryLabels: LocaleMap = {
  ru: {
    TEACHER: 'Учитель',
    LECTURER: 'Преподаватель',
    TUTOR: 'Репетитор',
    TRAINER: 'Тренер',
    EMPLOYEE: 'Сотрудник',
    STUDENT: 'Студент',
    PERSONAL: 'Личный',
  },
  tj: {
    TEACHER: 'Муаллим',
    LECTURER: 'Омӯзгор',
    TUTOR: 'Репетитор',
    TRAINER: 'Мурабби',
    EMPLOYEE: 'Корманд',
    STUDENT: 'Донишҷӯ',
    PERSONAL: 'Шахсӣ',
  },
};

/** Product names stay Latin by design. */
const planCodeLabels: LocaleMap = {
  ru: {
    STANDARD: 'Standard',
    PRO: 'Pro',
    PRO_PLUS: 'Pro Plus',
  },
  tj: {
    STANDARD: 'Standard',
    PRO: 'Pro',
    PRO_PLUS: 'Pro Plus',
  },
};

const serviceStatusLabels: LocaleMap = {
  ru: {
    healthy: 'Работает',
    warning: 'Есть предупреждение',
    error: 'Недоступно',
    not_configured: 'Не настроено',
    info: 'Информация',
  },
  tj: {
    healthy: 'Кор мекунад',
    warning: 'Огоҳӣ ҳаст',
    error: 'Дастнорас',
    not_configured: 'Танзим нашудааст',
    info: 'Маълумот',
  },
};

const releaseStatusLabels: LocaleMap = {
  ru: {
    DRAFT: 'Черновик',
    PUBLISHED: 'Опубликован',
    ARCHIVED: 'В архиве',
    PURGED: 'Удалён',
  },
  tj: {
    DRAFT: 'Лоиҳа',
    PUBLISHED: 'Нашр шуд',
    ARCHIVED: 'Дар бойгонӣ',
    PURGED: 'Нест шуд',
  },
};

const deviceActiveLabels: LocaleBool = {
  ru: { yes: 'Активно', no: 'Отозвано' },
  tj: { yes: 'Фаъол', no: 'Бозпас гирифта шуд' },
};

const adminActiveLabels: LocaleBool = {
  ru: { yes: 'Активен', no: 'Неактивен' },
  tj: { yes: 'Фаъол', no: 'Ғайрифаъол' },
};

const planPurchaseLabels: LocaleBool = {
  ru: { yes: 'Доступен для покупки', no: 'Отключён' },
  tj: { yes: 'Барои харид дастрас', no: 'Хомӯш' },
};

const telegramConnectedLabels: LocaleBool = {
  ru: { yes: 'Подключён', no: 'Не подключён' },
  tj: { yes: 'Пайваст', no: 'Пайваст нест' },
};

function unknownStatus(): string {
  return UNKNOWN[getActiveLocale()] ?? UNKNOWN.ru;
}

export function labelOrderStatus(status: string): string {
  return pick(orderStatusLabels, status, unknownStatus());
}

export function labelLicenseStatus(status: string): string {
  return pick(licenseStatusLabels, status, unknownStatus());
}

export function labelUserStatus(status: string): string {
  return pick(userStatusLabels, status, unknownStatus());
}

export function labelReceiptStatus(status: string): string {
  return pick(receiptStatusLabels, status, unknownStatus());
}

export function labelTrialStatus(status: string): string {
  return pick(trialStatusLabels, status, unknownStatus());
}

export function labelBillingPeriod(period: string): string {
  return pick(billingPeriodLabels, period, unknownStatus());
}

export function labelSystemHealth(value: string): string {
  return pick(systemHealthLabels, value, value);
}

export function labelServiceStatus(status: string): string {
  return pick(serviceStatusLabels, status, status);
}

export function labelUserCategory(category: string): string {
  return pick(userCategoryLabels, category, unknownStatus());
}

export function labelPlanCode(code: string): string {
  return pick(planCodeLabels, code, unknownStatus());
}

/** Product display name for admin (by code, not DB name). */
export function labelPlan(plan: { code: string; name?: string }): string {
  return labelPlanCode(plan.code);
}

export function labelPlatform(platform: string): string {
  const map: LocaleMap = {
    ru: { ANDROID: 'Android', IOS: 'iOS', WEB: 'Web' },
    tj: { ANDROID: 'Android', IOS: 'iOS', WEB: 'Web' },
  };
  return pick(map, platform, unknownStatus());
}

export function labelDeviceActive(isActive: boolean): string {
  return pickBool(deviceActiveLabels, isActive);
}

export function labelAdminActive(isActive: boolean): string {
  return pickBool(adminActiveLabels, isActive);
}

export function labelPlanPurchaseAvailability(isActive: boolean): string {
  return pickBool(planPurchaseLabels, isActive);
}

export function labelTelegramConnected(isVerified: boolean): string {
  return pickBool(telegramConnectedLabels, isVerified);
}

export function labelReleaseStatus(status: string): string {
  return pick(releaseStatusLabels, status, unknownStatus());
}

/** For tests: all known statuses must have localized labels. */
export const knownOrderStatuses = Object.keys(orderStatusLabels.ru);
export const knownLicenseStatuses = Object.keys(licenseStatusLabels.ru);
export const knownUserStatuses = Object.keys(userStatusLabels.ru);
export const knownReleaseStatuses = Object.keys(releaseStatusLabels.ru);
