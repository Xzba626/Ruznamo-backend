import type { TelegramI18n } from './telegram-i18n.types';

export const ru: TelegramI18n = {
  languageSelect: 'Забонро интихоб кунед / Выберите язык',
  languageButtonTj: '🇹🇯 Тоҷикӣ',
  languageButtonRu: '🇷🇺 Русский',
  languageChanged: '✅ Язык изменён.',
  userStartWelcome:
    'Добро пожаловать в Ruznamo.\n\n' +
    'Здесь вы можете приобрести лицензию, восстановить доступ и обратиться в поддержку.',
  welcomeNoLicense: (name) =>
    `Здравствуйте${name ? `, ${name}` : ''}!`,
  welcomeActiveLicense: (expiresAt) =>
    `Ближайшее окончание лицензии: ${expiresAt}`,
  choosePlan: 'Выберите тариф:',
  planUnavailable: 'Этот тариф сейчас недоступен для покупки.',
  purchaseUnavailable: 'Сейчас покупка лицензий временно недоступна.',
  planStandardLabel: 'Standard',
  planProLabel: 'Pro',
  standardTariffCard: () =>
    `Standard\n\n` +
    `✓ Полный доступ ко всем функциям Ruznamo\n` +
    `✓ Без рекламы\n` +
    `✓ До 2 активных устройств одновременно\n` +
    `✓ Персональный лицензионный ключ\n` +
    `✓ Вход и восстановление через Telegram\n` +
    `✓ Просмотр/копирование своего ключа после безопасной проверки\n` +
    `✓ Безопасная смена устройства\n` +
    `✓ Поддержка Ruznamo`,
  standardDurationMonthButton: (price) => `1 месяц · ${price}`,
  standardDurationYearButton: (price) => `1 год · ${price}`,
  standardBuyButton: 'Купить Standard',
  chooseDuration: (planName) => `Выберите срок для ${planName}:`,
  duration30Days: (price) => `30 дней — ${price}`,
  duration365Days: (price) => `365 дней — ${price}`,
  durationUnavailable: 'Этот срок сейчас недоступен. Выберите другой.',
  planStandard: (price, days) => `Standard\n${days} дней — ${price}`,
  planPro: (price, days) => `Pro\n${days} дней — ${price}`,
  paymentSummary: (planName, days, amount) =>
    `Тариф: ${planName}\nСрок: ${days} дней\nСумма: ${amount}`,
  choosePaymentMethod: 'Выберите способ оплаты:',
  paymentInstructions: (methodName, planName, amount, days, paymentValue, recipient) =>
    `Способ оплаты: ${methodName}\n\nТариф: ${planName}\nСрок: ${days} дней\nСумма: ${amount}\n\nРеквизиты:\n\`${paymentValue}\`\n\nПолучатель:\n${recipient}\n\nПосле оплаты отправьте сюда фото или PDF чека.`,
  askReceipt: 'Сейчас ожидается подтверждение оплаты. Отправьте фотографию или PDF чека.',
  paymentAwaitingReceiptHint:
    'Сейчас ожидается подтверждение оплаты. Отправьте фотографию или PDF чека.',
  invalidInputUseButtons: 'Сейчас нужно выбрать вариант кнопкой ниже.',
  receiptReceived: '✅ Чек получен.\n\nОжидайте проверки администратором.',
  noAwaitingOrder: 'Сначала выберите тариф, затем отправьте чек об оплате.',
  paymentApproved: (planName, days, expiresAt, key) =>
    `✅ Оплата подтверждена\n\nТариф: ${planName}\nСрок: ${days} дней\nДействует до: ${expiresAt}\n\nВаш лицензионный ключ:\n\`${key}\`\n\nВведите этот ключ в приложении Ruznamo.`,
  paymentRejected:
    '❌ Платёж не подтверждён.\n\nПожалуйста, проверьте оплату и отправьте новый чек или выберите тариф заново.',
  myLicensesTitle: '🔑 Мои лицензии',
  subscriptionInfo: (plan, days, expiresAt, maskedKey) =>
    `Тариф: ${plan}\nСрок: ${days} дней\nДействует до: ${expiresAt}\nКлюч: ${maskedKey}`,
  licenseListItem: (plan, status, expiresAt, devicesUsed, deviceLimit, source, maskedKey) =>
    `${plan}\nСтатус: ${status}\nДействует до: ${expiresAt}\nУстройства: ${devicesUsed} из ${deviceLimit}\nИсточник: ${source}\nКлюч: ${maskedKey}`,
  noActiveLicense: 'У вас пока нет лицензий. Нажмите /buy или «Купить лицензию» в меню.',
  instructionTitle: '📖 Инструкция',
  instructionBody:
    '1. Нажмите «Купить лицензию» (/buy).\n' +
    '2. Выберите тариф и срок (30 или 365 дней).\n' +
    '3. Выберите способ оплаты и переведите точную сумму.\n' +
    '4. Отправьте фото или PDF чека в этот чат.\n' +
    '5. Дождитесь подтверждения администратором.\n' +
    '6. Получите лицензионный ключ.\n' +
    '7. Введите ключ в приложении Ruznamo на Android.\n' +
    '8. «Мои лицензии» (/licenses) — все ваши ключи.\n' +
    '9. При проблемах — /support.',
  supportWelcome:
    'Поддержка Ruznamo\n\n' +
    'Опишите ваш вопрос или проблему.\n' +
    'Можно отправить текст, фотографию или документ.\n' +
    'Администратор ответит вам здесь в Telegram.',
  supportCategoryPrompt: 'Выберите тему обращения:',
  supportCategoryTechnical: 'Техническая проблема',
  supportCategoryLicense: 'Лицензия / ключ',
  supportCategoryPayment: 'Оплата',
  supportCategoryDevice: 'Устройство',
  supportCategoryOther: 'Другое',
  supportCategoryLabel: (category) => {
    const map: Record<string, string> = {
      technical: 'Техническая проблема',
      license: 'Лицензия / ключ',
      payment: 'Оплата',
      device: 'Устройство',
      other: 'Другое',
    };
    return map[category] ?? category;
  },
  supportMessageSent: '✅ Сообщение передано администратору.\nОжидайте ответа здесь.',
  supportCloseConfirm: 'Завершить это обращение?',
  supportCloseConfirmYes: 'Да, завершить',
  supportCloseConfirmNo: 'Продолжить диалог',
  supportClosedFinal: 'Обращение завершено. Если понадобится помощь, вы сможете создать новое.',
  supportExit: '✖️ Завершить обращение',
  supportExited: 'Обращение завершено. Вы можете снова открыть поддержку через /support.',
  supportDirectContact: 'Написать руководству в Telegram',
  supportPhoneLabel: (phone) => `Телефон поддержки: ${phone}`,
  sourceTelegram: 'Telegram',
  sourceManual: 'Выдана администратором',
  sourceUnknown: 'Не определён',
  help: 'Используйте меню команд Telegram или /instruction для подробной инструкции.',
  supportRelayed: 'Ваше сообщение передано администратору. Пожалуйста, ожидайте.',
  supportRelayUnavailable: 'Поддержка временно недоступна. Попробуйте позже.',
  supportAttachmentRelayed: 'Ваш файл передан администратору. Пожалуйста, ожидайте.',
  supportReplyFromAdmin: (body) =>
    body ? `💬 Ответ службы поддержки:\n\n${body}` : '💬 Ответ службы поддержки',
  adminSupportReplyTargetUnknown: 'Не удалось определить получателя этого ответа.',
  unsupportedAttachment: 'Этот тип файла не поддерживается. Отправьте фото или PDF чека.',
  replyBuyLicense: '🛒 Купить лицензию',
  replyMyLicenses: '🔑 Мои лицензии',
  replySupport: '💬 Поддержка',
  replyLanguage: '🌐 Язык',
  replyMainMenu: '🏠 Главное меню',
  menuLanguage: '🌐 Язык',
  menuMyKey: '🔑 Мой ключ',
  menuMySub: '📋 Моя подписка',
  menuHelp: '❓ Помощь',
  menuGetKey: '🔑 Получить ключ',
  menuRetry: '🔄 Попробовать снова',
  menuBack: '⬅️ Назад',
  adminWelcome: 'Вы вошли как администратор. Используйте меню команд или /admin.',
  adminUnauthorized: 'Нет доступа.',
  adminApprovedDuplicate: 'Эта заявка уже подтверждена.',
  adminRejectedDuplicate: 'Эта заявка уже отклонена.',
  linkConfirmPrompt: (plan, expiresAt, maskedKey, deviceLabel) =>
    `Привязать этот Telegram-аккаунт к лицензии Ruznamo?\n\n` +
    `Тариф: ${plan}\n` +
    `Действует до: ${expiresAt}\n` +
    `Ключ: ${maskedKey}\n` +
    `Устройство: ${deviceLabel}`,
  linkConfirmButton: '✅ Привязать',
  linkCancelButton: '❌ Отмена',
  linkSuccess: '✅ Telegram-аккаунт привязан к лицензии.',
  linkAlreadyLinked: 'ℹ️ Этот Telegram-аккаунт уже привязан к лицензии.',
  linkHolderConflict: '❌ Лицензия уже управляется другим Telegram-аккаунтом. Обратитесь в поддержку.',
  linkExpired: '❌ Ссылка для привязки истекла или недействительна.',
  replacementConfirmPrompt: (oldDevice, newDevice) =>
    `Отключить старое устройство и разрешить новое?\n\n` +
    `Старое: ${oldDevice}\n` +
    `Новое: ${newDevice}`,
  replacementConfirmButton: '✅ Заменить устройство',
  replacementSuccess: '✅ Устройство заменено. Новое устройство может использовать лицензию.',
  licenseDevicesTitle: '📱 Устройства',
  revokeDeviceButton: 'Отключить устройство',
  revokeDeviceConfirm: 'Подтвердите отключение устройства с этой лицензии.',
  deviceRevoked: '✅ Устройство отключено.',
  deviceRevokedUsage: (before, max, after) =>
    `✅ Устройство отключено.\n\nБыло: ${before} из ${max}\nСтало: ${after} из ${max}`,
  licenseControlSection: '🔐 Управление лицензией',
  telegramAuthOtp: (code) =>
    `Код подтверждения:\n\n${code}\n\nКод действует 5 минут.\nНикому его не сообщайте.`,
  telegramAuthOtpRecovery: (code) =>
    `Восстановление доступа Ruznamo\n\nКод подтверждения:\n\n${code}\n\nКод действует 5 минут.\nНикому его не сообщайте.`,
  telegramAuthOtpLink: (code) =>
    `Привязка Telegram\n\nВы привязываете Telegram к лицензии Standard.\n\nКод подтверждения:\n\n${code}\n\nКод действует 5 минут.\nНикому его не сообщайте.`,
  telegramAuthCopyCode: '📋 Скопировать код',
  telegramAuthChallengeUsed: '❌ Эта ссылка уже использована или истекла.',
  telegramAuthChallengeExpired: '❌ Эта ссылка уже использована или истекла.',
  telegramAuthNoLicenses:
    'К этому Telegram-аккаунту не привязано ни одной лицензии Ruznamo.',
  mainMenuTitle: '🏠 Главное меню Ruznamo',
  replyRecoverAccess: '♻️ Восстановить доступ',
  recoverAccessBody:
    'Восстановление запускается из приложения Ruznamo.\n\n' +
    'Откройте:\nНастройки → Лицензия → Ключ доступа → Восстановить доступ\n\n' +
    'Ruznamo откроет Telegram автоматически.',
  replyAdminMenu: '🛠 Меню администратора',
  stopAcknowledged: 'Текущая операция завершена.',
  adminRootTitle: 'Панель администратора Ruznamo',
  adminMenuTitle: '🛠 Панель администратора',
  adminMenuOrders: '💳 Заявки на оплату',
  adminMenuRequisites: '💰 Реквизиты',
  adminMenuSupport: '💬 Поддержка',
  adminMenuLicenses: '🔑 Лицензии',
  adminMenuCreateLicense: '➕ Создать лицензию',
  adminSupportInboxTitle: '💬 Открытые обращения',
  adminSupportEmpty: 'Нет открытых обращений.',
  adminSupportConversationTitle: (user) => `Обращение: ${user}`,
  adminSupportReplyButton: '✍️ Ответить',
  adminSupportReplySent: '✅ Ответ отправлен пользователю.',
  adminSupportReplyCancel: 'Отмена',
  adminSupportBackToList: '⬅️ К обращениям',
  adminSupportDetailTitle: (ticket) => `Обращение #${ticket}`,
  adminSupportInboxCount: (count) => `Открытые обращения: ${count}`,
  adminSupportInboxRow: (ticket, user, category, preview) =>
    `#${ticket} · ${user}\n${category}\n«${preview}»`,
  adminCreateLicenseTitle: 'Создание лицензии',
  adminCreateLicenseConfirm: (plan, period) =>
    `${plan}\nСрок: ${period}\nИсточник: ручная выдача\n\nСоздать лицензию?`,
  adminCreateLicenseSuccess: (plan, expiresAt, key) =>
    `✅ Лицензия создана\n\n${plan}\nДо: ${expiresAt}\n\nКлюч:\n\`${key}\``,
  adminCopyKeyButton: '📋 Скопировать ключ',
  adminSupportReplyPrompt: 'Напишите ответ пользователю.\nМожно отправить текст, фотографию или документ.',
  adminSupportClosed: '✅ Обращение закрыто.',
  staleCallback: 'Этот экран уже устарел. Откройте актуальное меню.',
  buttonUnavailable: 'Эта кнопка больше недоступна.',
  pendingOrderExists: 'У вас есть незавершённая заявка на оплату.',
  continuePendingPayment: '▶️ Продолжить оплату',
  cancelPendingOrder: '✖️ Отменить заявку',
  newPurchase: '🛒 Новая покупка',
  sendReceiptButton: '📎 Отправить чек',
  cancelPaymentButton: '✖️ Отменить оплату',
  cancelPaymentConfirm: 'Отменить эту заявку на оплату?',
  cancelPaymentYes: '✅ Да, отменить',
  cancelPaymentNo: '↩️ Нет',
  paymentCancelled: 'Заявка на оплату отменена.',
  receiptSentShort: '✅ Чек отправлен.\nПосле проверки вы получите результат здесь.',
  myOrderButton: '🧾 Моя заявка',
  disconnectDeviceTitle: (device, plan) => `Отключить ${device} от лицензии ${plan}?`,
  disconnectDeviceBody:
    'Устройство потеряет доступ по этой лицензии.\nДругой лицензионный ключ можно будет активировать.\nДля повторного подключения к этой же лицензии потребуется подтверждение через Telegram.',
  disconnectConfirmYes: '✅ Отключить',
  disconnectCancel: '↩️ Отмена',
  backToDevices: '📱 К устройствам',
  showKeyButton: '🔐 Показать ключ',
  licenseDevicesButton: '📱 Устройства',
  instructionGettingStarted: '🚀 Начало работы',
  instructionLicense: '🔑 Лицензия',
  instructionSchedule: '📅 Расписание',
  instructionDevices: '📱 Устройства',
  instructionRecovery: '♻️ Восстановление',
  instructionSupport: '💬 Поддержка',
  instructionArticleGettingStarted:
    'Установите Ruznamo на Android, откройте приложение и при необходимости купите или восстановите лицензию через Telegram.',
  instructionArticleLicense:
    'Купите лицензию в боте → оплатите → отправьте чек → получите ключ → введите ключ в приложении (Настройки → Лицензия).',
  instructionArticleSchedule:
    'Расписание ведётся в приложении Ruznamo. Бот помогает с лицензией, оплатой и поддержкой.',
  instructionArticleDevices:
    'Одна лицензия Standard — до 2 активных устройств. Отключение устройства освобождает слот лицензии, но не блокирует телефон глобально.',
  instructionArticleRecovery:
    'Восстановление запускается из приложения: Настройки → Лицензия → Ключ доступа → Восстановить доступ. Ruznamo откроет Telegram автоматически.',
  instructionArticleSupport:
    'В боте: Поддержка → выберите тему → опишите проблему. Администратор ответит в этом же чате.',
  telegramAuthOtpLogin: (code) =>
    `Вход в Ruznamo\n\nКод подтверждения:\n\n${code}\n\nКод действует 5 минут.\nНикому его не сообщайте.`,
  chooseActionButtons: 'Выберите действие кнопками ниже.',
  adminChooseAction: 'Выберите действие кнопками.',
  adminPanelButton: '🏠 Панель администратора',
  orderCancelledShort: 'Заявка отменена.',
  retryButton: '🔄 Повторить',
  temporaryError: 'Не удалось выполнить запрос. Попробуйте ещё раз.',
  dataUnavailable: 'Данные больше недоступны.',
  operationUnavailable: 'Эта операция недоступна для вашего аккаунта.',
  rateLimited: 'Слишком много попыток. Попробуйте позже.',
  operationExpired: 'Время действия операции истекло. Начните заново.',
};
