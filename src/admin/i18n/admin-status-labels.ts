/** Русские метки статусов для тестов и документации (enum-значения в коде остаются на английском). */
export const ORDER_STATUS_LABELS_RU: Record<string, string> = {
  PENDING: 'Ожидает оплаты',
  RECEIPT_SUBMITTED: 'Чек получен',
  UNDER_REVIEW: 'На проверке',
  APPROVED: 'Подтверждено',
  REJECTED: 'Отклонено',
  COMPLETED: 'Завершено',
  CANCELLED: 'Отменено',
};

export const LICENSE_STATUS_LABELS_RU: Record<string, string> = {
  PENDING: 'Ожидает активации',
  ACTIVE: 'Активна',
  EXPIRED: 'Истекла',
  REVOKED: 'Отозвана',
  SUSPENDED: 'Приостановлена',
};

export const AUDIT_ACTION_LABELS_RU: Record<string, string> = {
  'telegram.user.started': 'Пользователь запустил Telegram-бота',
  'telegram.order.created': 'Создана заявка на оплату',
  'telegram.receipt.submitted': 'Пользователь отправил чек',
  'payment.approved': 'Оплата подтверждена',
  'payment.rejected': 'Оплата отклонена',
  'payment.approve.duplicate': 'Повторное подтверждение оплаты',
  'telegram.license.delivered': 'Лицензионный ключ отправлен пользователю',
};
