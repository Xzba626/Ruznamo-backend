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
  'admin.license.revoke': 'Лицензия отозвана администратором',
  'admin.token.refresh': 'Обновление сессии администратора',
  'admin.logout': 'Выход администратора',
  'admin.password.changed': 'Пароль администратора изменён',
  'admin.app_config.update': 'Обновлена конфигурация приложения',
  'user.registered': 'Зарегистрирован новый пользователь',
  'device.registered': 'Зарегистрировано устройство',
  'device.revoked': 'Устройство отозвано',
  'mobile.login': 'Вход с мобильного устройства',
  'mobile.refresh': 'Обновление мобильной сессии',
  'mobile.logout': 'Выход из мобильной сессии',
  'mobile.logout_all': 'Выход из всех мобильных сессий',
  'trial.granted': 'Выдан пробный период',
  'license.activated': 'Лицензия активирована',
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
  AdminTelegramLinkToken: 'Код привязки Telegram',
  AdminTelegramIdentity: 'Telegram администратора',
};

export function labelAuditAction(action: string): string {
  return auditActionLabels[action] ?? action;
}

export function labelEntityType(entityType: string): string {
  return entityTypeLabels[entityType] ?? entityType;
}

export const knownAuditActions = Object.keys(auditActionLabels);
