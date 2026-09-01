import { BillingPeriod } from '@prisma/client';
import { billingPeriodDays } from './i18n';
import { maskLicenseKeyPrefix, resolveOrderTermDays } from './license-term.util';

describe('license-term.util', () => {
  it('resolves 30 days for MONTHLY', () => {
    expect(resolveOrderTermDays(BillingPeriod.MONTHLY)).toBe(30);
  });

  it('resolves 365 days for YEARLY', () => {
    expect(resolveOrderTermDays(BillingPeriod.YEARLY)).toBe(365);
  });

  it('masks license key prefix', () => {
    expect(maskLicenseKeyPrefix('ABCD')).toBe('ABCD••••••••');
  });

  it('billingPeriodDays matches resolveOrderTermDays', () => {
    expect(billingPeriodDays('YEARLY')).toBe(resolveOrderTermDays(BillingPeriod.YEARLY));
  });
});
