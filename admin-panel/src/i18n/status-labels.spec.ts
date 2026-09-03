import { describe, expect, it, beforeEach } from 'vitest';
import {
  setActiveLocale,
  labelRole,
  labelAdminActive,
  labelOrderStatus,
  labelLicenseStatus,
  labelUserStatus,
  labelDeviceActive,
  labelTelegramConnected,
  labelReleaseStatus,
  labelPlanCode,
  knownOrderStatuses,
  knownLicenseStatuses,
  knownUserStatuses,
} from './index';

describe('centralized status/role localization', () => {
  beforeEach(() => {
    setActiveLocale('ru');
  });

  it('maps admin roles in RU and TJ', () => {
    setActiveLocale('ru');
    expect(labelRole('SUPER_ADMIN')).toBe('Суперадминистратор');
    expect(labelRole('ADMIN')).toBe('Администратор');
    setActiveLocale('tj');
    expect(labelRole('SUPER_ADMIN')).toBe('Супермудир');
    expect(labelRole('ADMIN')).toBe('Мудир');
    expect(labelRole('SUPPORT')).toBe('Дастгирӣ');
  });

  it('maps account status in RU and TJ without Russian leakage on TJ', () => {
    setActiveLocale('ru');
    expect(labelAdminActive(true)).toBe('Активен');
    expect(labelAdminActive(false)).toBe('Неактивен');
    setActiveLocale('tj');
    expect(labelAdminActive(true)).toBe('Фаъол');
    expect(labelAdminActive(false)).toBe('Ғайрифаъол');
    expect(labelAdminActive(true)).not.toBe('Активен');
  });

  it('maps order/license/user/device/telegram/release statuses for both locales', () => {
    setActiveLocale('ru');
    expect(labelOrderStatus('APPROVED')).toBe('Подтверждено');
    expect(labelLicenseStatus('ACTIVE')).toBe('Активна');
    expect(labelUserStatus('ACTIVE')).toBe('Активен');
    expect(labelDeviceActive(true)).toBe('Активно');
    expect(labelTelegramConnected(true)).toBe('Подключён');
    expect(labelReleaseStatus('DRAFT')).toBe('Черновик');

    setActiveLocale('tj');
    expect(labelOrderStatus('APPROVED')).toBe('Тасдиқ шуд');
    expect(labelLicenseStatus('ACTIVE')).toBe('Фаъол');
    expect(labelUserStatus('ACTIVE')).toBe('Фаъол');
    expect(labelDeviceActive(false)).toBe('Бозпас гирифта шуд');
    expect(labelTelegramConnected(false)).toBe('Пайваст нест');
    expect(labelReleaseStatus('PUBLISHED')).toBe('Нашр шуд');
  });

  it('keeps product plan names Latin in both locales', () => {
    for (const locale of ['ru', 'tj'] as const) {
      setActiveLocale(locale);
      expect(labelPlanCode('STANDARD')).toBe('Standard');
      expect(labelPlanCode('PRO')).toBe('Pro');
      expect(labelPlanCode('PRO_PLUS')).toBe('Pro Plus');
    }
  });

  it('covers known enum keys for both locales', () => {
    for (const locale of ['ru', 'tj'] as const) {
      setActiveLocale(locale);
      for (const status of knownOrderStatuses) {
        expect(labelOrderStatus(status)).not.toBe(status);
      }
      for (const status of knownLicenseStatuses) {
        expect(labelLicenseStatus(status)).not.toBe(status);
      }
      for (const status of knownUserStatuses) {
        expect(labelUserStatus(status)).not.toBe(status);
      }
    }
  });
});
