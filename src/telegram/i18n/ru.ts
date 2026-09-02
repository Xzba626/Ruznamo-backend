import type { TelegramI18n } from './telegram-i18n.types';

export const ru: TelegramI18n = {
  languageSelect: 'Забонро интихоб кунед / Выберите язык',
  languageButtonTj: '🇹🇯 Тоҷикӣ',
  languageButtonRu: '🇷🇺 Русский',
  languageChanged: '✅ Язык изменён.',
  welcomeNoLicense: (name) =>
    `Здравствуйте${name ? `, ${name}` : ''}!\n\nИспользуйте меню (кнопка рядом с полем ввода) или команды бота.`,
  welcomeActiveLicense: (expiresAt) =>
    `Здравствуйте!\n\nУ вас есть активные лицензии. Ближайшее окончание: ${expiresAt}`,
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
    'Здравствуйте. Опишите ваш вопрос, проблему, предложение или идею для Ruznamo.\n\nСообщение будет передано службе поддержки.',
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
};
