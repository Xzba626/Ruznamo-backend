import { TelegramLanguage } from '@prisma/client';
import { ru } from './ru';
import { tj } from './tj';
import type { TelegramI18n } from './telegram-i18n.types';

export type { TelegramI18n } from './telegram-i18n.types';
export type TelegramLang = TelegramLanguage;

export const DEFAULT_TELEGRAM_LANG: TelegramLang = TelegramLanguage.TJ;

export function resolveLang(language: TelegramLanguage | null | undefined): TelegramLang {
  return language ?? DEFAULT_TELEGRAM_LANG;
}

export function getTelegramI18n(language: TelegramLanguage | null | undefined): TelegramI18n {
  return language === TelegramLanguage.RU ? ru : tj;
}

export const LICENSE_DURATION_DAYS = {
  MONTHLY: 30,
  YEARLY: 365,
} as const;

export function billingPeriodDays(billingPeriod: 'MONTHLY' | 'YEARLY'): number {
  return billingPeriod === 'YEARLY' ? LICENSE_DURATION_DAYS.YEARLY : LICENSE_DURATION_DAYS.MONTHLY;
}
