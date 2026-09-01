import type { TelegramI18n } from './telegram-i18n.types';

export const ru: TelegramI18n = {
  languageSelect: 'Забонро интихоб кунед / Выберите язык',
  languageButtonTj: '🇹🇯 Тоҷикӣ',
  languageButtonRu: '🇷🇺 Русский',
  languageChanged: '✅ Язык изменён.',
  welcomeNoLicense: (name) =>
    `Здравствуйте${name ? `, ${name}` : ''}!\n\nДля полного доступа к приложению нужен активный лицензионный ключ.`,
  welcomeActiveLicense: (expiresAt) =>
    `Здравствуйте!\n\nВаша подписка активна до: ${expiresAt}`,
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
  noActiveLicense: 'У вас нет активной лицензии. Нажмите «Купить лицензию».',
  help:
    '❓ Помощь\n\n1. Выберите тариф\n2. Выберите способ оплаты\n3. Оплатите\n4. Отправьте чек\n5. Активируйте ключ в приложении',
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
  menuBack: '↩️ Назад',
  adminUnauthorized: 'Нет доступа.',
  adminApprovedDuplicate: 'Эта заявка уже подтверждена.',
  adminRejectedDuplicate: 'Эта заявка уже отклонена.',
};
