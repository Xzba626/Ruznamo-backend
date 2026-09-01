const errorCodeLabels: Record<string, string> = {
  UNAUTHORIZED: 'Сессия недействительна. Выполните вход повторно.',
  FORBIDDEN: 'Недостаточно прав для выполнения действия.',
  ERROR: 'Произошла ошибка при выполнении запроса.',
  SERVER_ERROR: 'Сервер недоступен. Повторите попытку позже.',
  INTERNAL_ERROR: 'Внутренняя ошибка сервера.',
  DEVICE_LIMIT_REACHED: 'Достигнут лимит активных устройств.',
  INVALID_REFRESH_TOKEN: 'Сессия недействительна. Выполните вход повторно.',
  REFRESH_TOKEN_EXPIRED: 'Срок действия сессии истёк. Выполните вход повторно.',
  DEVICE_REVOKED: 'Устройство отозвано.',
  LICENSE_INVALID: 'Недействительный лицензионный ключ.',
  LICENSE_REVOKED: 'Лицензия отозвана.',
  LICENSE_EXPIRED: 'Срок действия лицензии истёк.',
  MAINTENANCE_MODE: 'Сервис временно недоступен (техническое обслуживание).',
  HTTP_ERROR: 'Ошибка HTTP-запроса.',
};

const englishFallbackPatterns: Array<{ pattern: RegExp; message: string }> = [
  { pattern: /session expired/i, message: 'Сессия истекла. Выполните вход повторно.' },
  { pattern: /invalid username or password/i, message: 'Неверное имя пользователя или пароль.' },
  { pattern: /request failed/i, message: 'Не удалось выполнить запрос.' },
  { pattern: /backend is unavailable/i, message: 'Backend недоступен. Повторите попытку позже.' },
  { pattern: /unexpected response/i, message: 'Неожиданный ответ сервера.' },
];

export function localizeError(code: string, fallbackMessage?: string): string {
  if (errorCodeLabels[code]) {
    return errorCodeLabels[code];
  }

  if (fallbackMessage) {
    for (const { pattern, message } of englishFallbackPatterns) {
      if (pattern.test(fallbackMessage)) {
        return message;
      }
    }
  }

  return fallbackMessage && /[а-яА-ЯёЁ]/.test(fallbackMessage)
    ? fallbackMessage
    : (errorCodeLabels.ERROR ?? 'Произошла ошибка');
}

export function formatApiError(err: { code: string; message: string }): string {
  return localizeError(err.code, err.message);
}

export const knownErrorCodes = Object.keys(errorCodeLabels);
