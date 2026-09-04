const errorCodeLabels: Record<string, string> = {
  UNAUTHORIZED: 'Сессия недействительна. Выполните вход повторно.',
  FORBIDDEN: 'Недостаточно прав для выполнения действия.',
  ERROR: 'Произошла ошибка при выполнении запроса.',
  SERVER_ERROR: 'Сервер недоступен. Повторите попытку позже.',
  INTERNAL_ERROR: 'Внутренняя ошибка сервера.',
  DEVICE_LIMIT_REACHED: 'Достигнут лимит активных устройств.',
  INVALID_REFRESH_TOKEN: 'Сессия недействительна. Выполните вход повторно.',
  NETWORK_ERROR: 'Не удалось подключиться к серверу API. Проверьте адрес backend и настройки CORS.',
  REFRESH_TOKEN_EXPIRED: 'Срок действия сессии истёк. Выполните вход повторно.',
  DEVICE_REVOKED: 'Устройство отозвано.',
  LICENSE_INVALID: 'Недействительный лицензионный ключ.',
  LICENSE_REVOKED: 'Лицензия отозвана.',
  LICENSE_EXPIRED: 'Срок действия лицензии истёк.',
  MAINTENANCE_MODE: 'Сервис временно недоступен (техническое обслуживание).',
  HTTP_ERROR: 'Ошибка HTTP-запроса.',
  // Releases / APK upload pipeline
  OBJECT_STORAGE_NOT_CONFIGURED: 'Хранилище APK не настроено.',
  UPLOAD_ID_REQUIRED: 'Не удалось завершить обработку: отсутствует идентификатор загрузки.',
  APK_FILE_MISSING: 'APK не найден в хранилище после загрузки. Повторите загрузку.',
  APK_SIZE_MISMATCH: 'Размер загруженного файла не совпадает с содержимым APK.',
  VERSION_CODE_NOT_INCREASING: 'versionCode должен быть больше уже опубликованной версии.',
  VERSION_CODE_EXISTS: 'Релиз с таким versionCode уже существует.',
  INVALID_APK: 'Файл не является корректным APK.',
  INVALID_APK_METADATA: 'Не удалось прочитать package/version из APK.',
  APK_PACKAGE_MISMATCH: 'Пакет приложения не совпадает с Ruznamo.',
  APK_SIGNING_MISMATCH: 'Подпись APK не совпадает с настроенной production-подписью.',
  APK_INSPECT_FAILED: 'APK загружен, но не удалось проверить файл. Можно повторить обработку без повторной загрузки.',
  APK_INSPECTOR_UNAVAILABLE: 'Проверка APK временно недоступна на сервере. Повторите попытку позже.',
  BLOB_GET_FAILED: 'Не удалось прочитать APK из хранилища. Повторите обработку.',
  BLOB_OBJECT_NOT_FOUND: 'Объект APK не найден в хранилище.',
  BLOB_STREAM_UNSUPPORTED: 'Не удалось прочитать поток APK из хранилища.',
  BLOB_SMOKE_FAILED: 'Проверка хранилища не удалась.',
  SIGNING_POLICY_NOT_CONFIGURED:
    'APK загружен и проверен, но production-подпись ещё не настроена. Публикация недоступна.',
  MANIFEST_SIGNING_NOT_CONFIGURED:
    'Подпись release-manifest ещё не настроена. Публикация недоступна.',
  MANIFEST_SIGNING_FAILED: 'Не удалось подписать release-manifest. Проверьте ключ на сервере.',
  RELEASE_NOT_PUBLISHABLE: 'Релиз не может быть опубликован при текущей конфигурации безопасности.',
  RELEASE_NOT_DRAFT: 'Операция доступна только для черновика.',
  RELEASE_NOT_FOUND: 'Релиз не найден.',
  RELEASE_NOT_DOWNLOADABLE: 'Этот релиз недоступен для скачивания.',
  CHANGELOG_REQUIRED: 'Перед публикацией укажите «Что нового» на русском и тоҷикӣ.',
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
    : errorCodeLabels.ERROR;
}

export function formatApiError(err: { code: string; message: string }): string {
  return localizeError(err.code, err.message);
}

export const knownErrorCodes = Object.keys(errorCodeLabels);
