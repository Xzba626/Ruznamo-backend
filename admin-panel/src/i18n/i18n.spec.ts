import { describe, expect, it } from 'vitest';
import { labelAuditAction, labelLicenseStatus, labelOrderStatus, knownOrderStatuses } from './index';
import { localizeError } from './errors';

describe('admin-panel i18n', () => {
  it('maps required order statuses to Russian', () => {
    expect(labelOrderStatus('PENDING')).toBe('Ожидает оплаты');
    expect(labelOrderStatus('RECEIPT_SUBMITTED')).toBe('Чек получен');
    expect(labelOrderStatus('UNDER_REVIEW')).toBe('На проверке');
    expect(labelOrderStatus('APPROVED')).toBe('Подтверждено');
    expect(labelOrderStatus('REJECTED')).toBe('Отклонено');
    expect(labelOrderStatus('COMPLETED')).toBe('Завершено');
  });

  it('maps license statuses to Russian', () => {
    expect(labelLicenseStatus('ACTIVE')).toBe('Активна');
    expect(labelLicenseStatus('REVOKED')).toBe('Отозвана');
  });

  it('maps audit actions to Russian', () => {
    expect(labelAuditAction('payment.approved')).toBe('Оплата подтверждена');
    expect(labelAuditAction('telegram.receipt.submitted')).toBe('Пользователь отправил чек');
  });

  it('localizes API error codes to Russian', () => {
    expect(localizeError('UNAUTHORIZED')).toContain('Выполните вход повторно');
    expect(localizeError('DEVICE_LIMIT_REACHED')).toContain('лимит');
  });

  it('covers all known order statuses with Cyrillic labels', () => {
    for (const status of knownOrderStatuses) {
      expect(labelOrderStatus(status)).toMatch(/[а-яА-ЯёЁ]/);
    }
  });
});
