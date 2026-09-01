import { BillingPeriod } from '@prisma/client';
import { billingPeriodDays } from './i18n';

export function resolveOrderTermDays(billingPeriod: BillingPeriod): number {
  return billingPeriodDays(billingPeriod);
}

export function maskLicenseKeyPrefix(keyPrefix: string): string {
  return `${keyPrefix}••••••••`;
}
