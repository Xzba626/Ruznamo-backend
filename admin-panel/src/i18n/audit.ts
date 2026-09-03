const auditActionLabels: Record<string, string> = {
  'telegram.user.started': 'Пользователь запустил Telegram-бота',
  'telegram.order.created': 'Создана заявка на оплату',
  'telegram.receipt.submitted': 'Пользователь отправил чек',
  'payment.approved': 'Оплата подтверждена',
  'payment.rejected': 'Оплата отклонена',
  'payment.approve.duplicate': 'Повторное подтверждение оплаты',
  'telegram.license.delivered': 'Лицензионный ключ отправлен пользователю',
  'telegram.admin.unauthorized': 'Неавторизованная попытка действия администратора',
  'admin.login.success': 'Успешный вход администратора',
  'admin.login.failed': 'Неудачная попытка входа',
  'admin.telegram.link_token.created': 'Создан код привязки Telegram',
  'admin.telegram.linked': 'Telegram привязан к администратору',
  'admin.telegram.rebind.started': 'Начата смена Telegram администратора',
  'admin.telegram.replaced': 'Изменён Telegram администратора',
  'admin.sessions.revoked_others': 'Завершены другие сеансы администратора',
  'admin.license.revoke': 'Лицензия отозвана администратором',
  'admin.token.refresh': 'Обновление сессии администратора',
  'admin.logout': 'Выход администратора',
  'admin.password.changed': 'Пароль администратора изменён',
  'admin.profile.updated': 'Обновлён профиль администратора',
  'admin.app_config.update': 'Обновлена конфигурация приложения',
  'plan.purchaseAvailability.changed': 'Изменена доступность тарифа для покупки',
  'plan.prices.updated': 'Обновлены цены тарифа',
  'user.registered': 'Зарегистрирован новый пользователь',
  'device.registered': 'Зарегистрировано устройство',
  'device.revoked': 'Устройство отозвано',
  'mobile.login': 'Вход с мобильного устройства',
  'mobile.refresh': 'Обновление мобильной сессии',
  'mobile.logout': 'Выход из мобильной сессии',
  'mobile.logout_all': 'Выход из всех мобильных сессий',
  'trial.granted': 'Выдан пробный период',
  'license.activated': 'Лицензия активирована',
  'license.activation.idempotent': 'Повторная активация лицензии (без изменений)',
  'license.activation.duplicate': 'Повторная активация лицензии (без изменений)',
};

const entityTypeLabels: Record<string, string> = {
  User: 'Пользователь',
  DeviceInstallation: 'Устройство',
  Order: 'Заявка',
  Receipt: 'Чек',
  License: 'Лицензия',
  AdminUser: 'Администратор',
  RefreshToken: 'Сессия',
  TrialGrant: 'Пробный период',
  SystemConfig: 'Конфигурация',
  Plan: 'Тариф',
  AdminTelegramLinkToken: 'Код привязки Telegram',
  AdminTelegramIdentity: 'Telegram администратора',
  TelegramCallback: 'Telegram',
};

export const UNKNOWN_AUDIT_ACTION_LABEL = 'Системное событие';
export const UNKNOWN_ENTITY_LABEL = 'Неизвестный объект';

export interface AuditActionPresentation {
  label: string;
  technicalCode?: string;
}

export function formatAuditAction(action: string): AuditActionPresentation {
  const known = auditActionLabels[action];
  if (known) {
    return { label: known };
  }
  return { label: UNKNOWN_AUDIT_ACTION_LABEL, technicalCode: action };
}

export function labelAuditAction(action: string): string {
  return formatAuditAction(action).label;
}

export function labelEntityType(entityType: string): string {
  if (entityTypeLabels[entityType]) {
    return entityTypeLabels[entityType];
  }
  if (/^[A-Z][A-Za-z]+$/.test(entityType)) {
    return UNKNOWN_ENTITY_LABEL;
  }
  return entityTypeLabels[entityType] ?? UNKNOWN_ENTITY_LABEL;
}

export const knownAuditActions = Object.keys(auditActionLabels);
