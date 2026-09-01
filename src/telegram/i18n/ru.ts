import type { TelegramI18n } from './telegram-i18n.types';

export const ru: TelegramI18n = {
  languageSelect: 'Забонро интихоб кунед / Выберите язык',
  languageButtonTj: '🇹🇯 Тоҷикӣ',
  languageButtonRu: '🇷🇺 Русский',
  languageChanged: '✅ Язык изменён.',
  welcomeNoLicense: (name) =>
    `Здравствуйте${name ? `, ${name}` : ''}!\n\nДля полного доступа к приложению нужен активный лицензионный ключ.`,
  welcomeActiveLicense: (expiresAt) =>
    `Здравствуйте!\n\nВаша подписка активна до: ${expiresAt}\n\nВы можете снова посмотреть ключ или данные подписки.`,
  choosePlan: 'Выберите тариф:',
  planStandardLabel: 'Standard',
  planProLabel: 'Pro',
  chooseDuration: (planName) => `Выберите срок для ${planName}:`,
  duration30Days: (price) => `30 дней — ${price}`,
  duration365Days: (price) => `365 дней — ${price}`,
  durationUnavailable: 'Этот срок сейчас недоступен. Выберите другой.',
  planStandard: (price, days) => `Standard\n${days} дней — ${price}`,
  planPro: (price, days) => `Pro\n${days} дней — ${price}`,
  paymentInstructions: (planName, amount, days, card, recipient, extra) =>
    `Оплата тарифа ${planName}\n\nСрок: ${days} дней\nСумма: ${amount}\n\nРеквизиты:\n\`${card}\`\n\nПолучатель:\n${recipient}\n\n${extra}\n\nОплатите указанную сумму и отправьте сюда фото или файл чека.`,
  askReceipt: 'Пожалуйста, отправьте фото или файл подтверждения оплаты.',
  receiptReceived:
    '✅ Чек получен.\n\nОжидайте проверки администратором.',
  noAwaitingOrder: 'Сначала выберите тариф, затем отправьте чек об оплате.',
  paymentApproved: (key, days, expiresAt) =>
    `✅ Ваша оплата подтверждена.\n\nВаш лицензионный ключ:\n\`${key}\`\n\nСрок действия: ${days} дней (до ${expiresAt})\n\nВведите этот ключ в приложении Ruznamo.`,
  paymentRejected:
    '❌ Платёж не подтверждён.\n\nПожалуйста, проверьте оплату и отправьте новый чек или выберите тариф заново.',
  subscriptionInfo: (plan, expiresAt, prefix) =>
    `📋 Ваша подписка\n\nТариф: ${plan}\nДействует до: ${expiresAt}\nПрефикс ключа: ${prefix}...`,
  help:
    '❓ Помощь\n\n1. Выберите тариф\n2. Оплатите\n3. Отправьте чек\n4. Активируйте ключ в приложении',
  supportRelayed: 'Ваше сообщение передано администратору. Пожалуйста, ожидайте.',
  supportRelayUnavailable: 'Поддержка временно недоступна. Попробуйте позже.',
  supportAttachmentRelayed: 'Ваш файл передан администратору. Пожалуйста, ожидайте.',
  unsupportedAttachment: 'Этот тип файла не поддерживается. Отправьте фото или PDF чека.',
  menuLanguage: '🌐 Язык',
  menuMyKey: '🔑 Мой ключ',
  menuMySub: '📋 Моя подписка',
  menuHelp: '❓ Помощь',
  menuGetKey: '🔑 Получить ключ',
  menuRetry: '🔄 Попробовать снова',
  adminUnauthorized: 'Нет доступа.',
  adminApprovedDuplicate: 'Эта заявка уже подтверждена.',
  adminRejectedDuplicate: 'Эта заявка уже отклонена.',
};
