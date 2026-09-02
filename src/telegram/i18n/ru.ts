import type { TelegramI18n } from './telegram-i18n.types';

export const ru: TelegramI18n = {
  languageSelect: 'Забонро интихоб кунед / Выберите язык',
  languageButtonTj: '🇹🇯 Тоҷикӣ',
  languageButtonRu: '🇷🇺 Русский',
  languageChanged: '✅ Язык изменён.',
  welcomeNoLicense: (name) =>
    `Здравствуйте${name ? `, ${name}` : ''}!`,
  welcomeActiveLicense: (expiresAt) =>
    `Ближайшее окончание лицензии: ${expiresAt}`,
  choosePlan: 'Выберите тариф:',
  planUnavailable: 'Этот тариф сейчас недоступен для покупки.',
  purchaseUnavailable: 'Сейчас покупка лицензий временно недоступна.',
  planStandardLabel: 'Standard',
  planProLabel: 'Pro',
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
  askReceipt: 'Пожалуйста, отправьте фото или файл подтверждения оплаты.',
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
    'Опишите ваш вопрос, проблему, предложение или вопрос по сотрудничеству.',
  supportExit: '❌ Завершить обращение',
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
  licenseControlSection: '🔐 Управление лицензией',
  telegramAuthOtp: (code) =>
    `🔐 Подтверждение Ruznamo\n\n` +
    `Код подтверждения:\n${code}\n\n` +
    `Введите этот код в приложении Ruznamo.\n\n` +
    `Код действует 5 минут.\n\n` +
    `Никому не сообщайте этот код.`,
  telegramAuthChallengeUsed: '❌ Эта ссылка уже использована или истекла.',
  telegramAuthChallengeExpired: '❌ Эта ссылка уже использована или истекла.',
  telegramAuthNoLicenses:
    'К этому Telegram-аккаунту не привязано ни одной лицензии Ruznamo.',
  mainMenuTitle: '🏠 Главное меню Ruznamo',
  replyRecoverAccess: '♻️ Восстановить доступ',
  recoverAccessBody:
    'Для восстановления доступа откройте приложение Ruznamo на Android → «Восстановить доступ» → подтвердите личность через этот Telegram-бот.',
  replyAdminMenu: '🛠 Меню администратора',
  stopAcknowledged: 'Текущая операция завершена.',
  adminMenuTitle: '🛠 Меню администратора',
  adminMenuOrders: '💳 Заявки на оплату',
  adminMenuRequisites: '💳 Реквизиты',
  adminMenuSupport: '💬 Поддержка',
  adminMenuLicenses: '🔑 Лицензии',
  adminMenuCreateLicense: '➕ Создать лицензию',
  adminSupportInboxTitle: '💬 Открытые обращения',
  adminSupportEmpty: 'Нет открытых обращений.',
  adminSupportConversationTitle: (user) => `Обращение: ${user}`,
  adminSupportReplyPrompt: 'Введите ответ пользователю или ответьте Reply на сообщение в чате.',
  adminSupportClosed: '✅ Обращение закрыто.',
};
