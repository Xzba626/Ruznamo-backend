import { describe, expect, it } from 'vitest';
import {
  formatAuditAction,
  labelAuditAction,
  labelLicenseStatus,
  labelOrderStatus,
  labelPlan,
  labelPlanCode,
  labelPlanPurchaseAvailability,
  knownOrderStatuses,
} from './index';
import { localizeError } from './errors';
import { UNKNOWN_AUDIT_ACTION_LABEL } from './audit';

describe('admin-panel i18n', () => {
  it('maps required order statuses to Russian', () => {
    expect(labelOrderStatus('PENDING')).toBe('Ожидает оплаты');
    expect(labelOrderStatus('RECEIPT_SUBMITTED')).toBe('Чек получен');
    expect(labelOrderStatus('UNDER_REVIEW')).toBe('На проверке');
    expect(labelOrderStatus('APPROVED')).toBe('Подтверждено');
    expect(labelOrderStatus('REJECTED')).toBe('Отклонено');
    expect(labelOrderStatus('COMPLETED')).toBe('Завершено');
  });

  it('uses Russian fallback for unknown statuses', () => {
    expect(labelOrderStatus('SOME_NEW_STATUS')).toBe('Неизвестный статус');
    expect(labelLicenseStatus('UNKNOWN')).toBe('Неизвестный статус');
  });

  it('maps plan codes to Russian presentation labels', () => {
    expect(labelPlanCode('STANDARD')).toBe('Стандарт');
    expect(labelPlanCode('PRO')).toBe('Про');
    expect(labelPlanCode('PRO_PLUS')).toBe('Про+');
    expect(labelPlan({ code: 'PRO', name: 'Pro' })).toBe('Про');
  });

  it('maps plan purchase availability to Russian', () => {
    expect(labelPlanPurchaseAvailability(true)).toBe('Доступен для покупки');
    expect(labelPlanPurchaseAvailability(false)).toBe('Отключён');
  });

  it('maps audit actions to Russian and unknown events safely', () => {
    expect(labelAuditAction('payment.approved')).toBe('Оплата подтверждена');
    const unknown = formatAuditAction('some.new.backend.event');
    expect(unknown.label).toBe(UNKNOWN_AUDIT_ACTION_LABEL);
    expect(unknown.technicalCode).toBe('some.new.backend.event');
  });

  it('localizes API error codes to Russian', () => {
    expect(localizeError('UNAUTHORIZED')).toContain('Выполните вход повторно');
    expect(localizeError('DEVICE_LIMIT_REACHED')).toContain('лимит');
    expect(localizeError('UNKNOWN_CODE', 'Request failed')).not.toBe('Request failed');
  });

  it('covers all known order statuses with Cyrillic labels', () => {
    for (const status of knownOrderStatuses) {
      expect(labelOrderStatus(status)).toMatch(/[а-яА-ЯёЁ]/);
    }
  });
});
