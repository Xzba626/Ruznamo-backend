import {
  AUDIT_ACTION_LABELS_RU,
  LICENSE_STATUS_LABELS_RU,
  ORDER_STATUS_LABELS_RU,
} from './admin-status-labels';

describe('Admin Russian status mappings', () => {
  it('maps required order statuses to Russian', () => {
    expect(ORDER_STATUS_LABELS_RU.PENDING).toBe('Ожидает оплаты');
    expect(ORDER_STATUS_LABELS_RU.RECEIPT_SUBMITTED).toBe('Чек получен');
    expect(ORDER_STATUS_LABELS_RU.UNDER_REVIEW).toBe('На проверке');
    expect(ORDER_STATUS_LABELS_RU.APPROVED).toBe('Подтверждено');
    expect(ORDER_STATUS_LABELS_RU.REJECTED).toBe('Отклонено');
    expect(ORDER_STATUS_LABELS_RU.COMPLETED).toBe('Завершено');
  });

  it('maps license statuses to Russian', () => {
    expect(LICENSE_STATUS_LABELS_RU.ACTIVE).toBe('Активна');
    expect(LICENSE_STATUS_LABELS_RU.EXPIRED).toBe('Истекла');
    expect(LICENSE_STATUS_LABELS_RU.REVOKED).toBe('Отозвана');
  });

  it('maps audit payment actions to Russian', () => {
    expect(AUDIT_ACTION_LABELS_RU['payment.approved']).toBe('Оплата подтверждена');
    expect(AUDIT_ACTION_LABELS_RU['telegram.receipt.submitted']).toBe('Пользователь отправил чек');
  });

  it('does not leave English labels in required order statuses', () => {
    for (const label of Object.values(ORDER_STATUS_LABELS_RU)) {
      expect(label).toMatch(/[а-яА-ЯёЁ]/);
      expect(label).not.toMatch(/^[A-Z_]+$/);
    }
  });
});
