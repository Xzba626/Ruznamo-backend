import type { TelegramI18n } from './telegram-i18n.types';

export const tj: TelegramI18n = {
  languageSelect: 'Забонро интихоб кунед / Выберите язык',
  languageButtonTj: '🇹🇯 Тоҷикӣ',
  languageButtonRu: '🇷🇺 Русский',
  languageChanged: '✅ Забон тағйир дода шуд.',
  welcomeNoLicense: (name) =>
    `Салом${name ? `, ${name}` : ''}!\n\nМенюи бот (тугма дар назди майдони матн) ё фармонҳоро истифода баред.`,
  welcomeActiveLicense: (expiresAt) => `Салом!\n\nИҷозатномаҳои фаъол доред. Анҷоми наздиктарин: ${expiresAt}`,
  choosePlan: 'Тарифро интихоб кунед:',
  planUnavailable: 'Ин тариф ҳоло барои харид дастрас нест.',
  purchaseUnavailable: 'Ҳоло харидани иҷозатнома муваққатан дастрас нест.',
  planStandardLabel: 'Standard',
  planProLabel: 'Pro',
  chooseDuration: (planName) => `Муддатро барои ${planName} интихоб кунед:`,
  duration30Days: (price) => `30 рӯз — ${price}`,
  duration365Days: (price) => `365 рӯз — ${price}`,
  durationUnavailable: 'Ин муддат ҳозир дастрас нест. Лутфан муддати дигарро интихоб кунед.',
  planStandard: (price, days) => `Standard\n${days} рӯз — ${price}`,
  planPro: (price, days) => `Pro\n${days} рӯз — ${price}`,
  paymentSummary: (planName, days, amount) =>
    `Тариф: ${planName}\nМӯҳлат: ${days} рӯз\nМаблағ: ${amount}`,
  choosePaymentMethod: 'Усули пардохтро интихоб кунед:',
  paymentInstructions: (methodName, planName, amount, days, paymentValue, recipient) =>
    `Усули пардохт: ${methodName}\n\nТариф: ${planName}\nМӯҳлат: ${days} рӯз\nМаблағ: ${amount}\n\nРеквизитҳо:\n\`${paymentValue}\`\n\nҚабулкунанда:\n${recipient}\n\nПас аз пардохт акси ё PDF-и чекро инҷо фиристед.`,
  askReceipt: 'Лутфан акси чек ё файли тасдиқкунандаи пардохтро фиристед.',
  receiptReceived:
    '✅ Чек қабул шуд.\n\nСанҷиши пардохт идома дорад. Лутфан интизор шавед — маъмурият чекро месанҷад.',
  noAwaitingOrder: 'Аввал тарифро интихоб кунед, сонӣ чеки пардохтро фиристед.',
  paymentApproved: (planName, days, expiresAt, key) =>
    `✅ Пардохти шумо тасдиқ шуд\n\nТариф: ${planName}\nМӯҳлат: ${days} рӯз\nТо: ${expiresAt}\n\nКалиди иҷозатномаи шумо:\n\`${key}\`\n\nКалидро дар барномаи Ruznamo ворид кунед.`,
  paymentRejected:
    '❌ Пардохт тасдиқ нашуд.\n\nЛутфан пардохтро санҷед ва чеки нав фиристед ё тарифро аз нав интихоб кунед.',
  myLicensesTitle: '🔑 Иҷозатномаҳои ман',
  subscriptionInfo: (plan, days, expiresAt, maskedKey) =>
    `Тариф: ${plan}\nМӯҳлат: ${days} рӯз\nТо: ${expiresAt}\nКалид: ${maskedKey}`,
  licenseListItem: (plan, status, expiresAt, devicesUsed, deviceLimit, source, maskedKey) =>
    `${plan}\nҲолат: ${status}\nТо: ${expiresAt}\nДастгоҳҳо: ${devicesUsed} аз ${deviceLimit}\nМанбаъ: ${source}\nКалид: ${maskedKey}`,
  noActiveLicense: 'Ҳоло иҷозатнома нест. /buy ё «Харидани иҷозатнома»-ро пахш кунед.',
  instructionTitle: '📖 Дастур',
  instructionBody:
    '1. «Харидани иҷозатнома» (/buy)-ро пахш кунед.\n' +
    '2. Тариф ва муддат (30 ё 365 рӯз) интихоб кунед.\n' +
    '3. Усули пардохт ва маблағи дақиқро интихоб кунед.\n' +
    '4. Акси ё PDF-и чекро фиристед.\n' +
    '5. Тасдиқи маъмуриятро интизор шавед.\n' +
    '6. Калиди иҷозатномаро гиред.\n' +
    '7. Калидро дар барномаи Ruznamo ворид кунед.\n' +
    '8. /licenses — ҳамаи иҷозатномаҳои шумо.\n' +
    '9. Мушкилӣ? — /support.',
  supportWelcome:
    'Салом. Савол, мушкилӣ, пешниҳод ё идеяи худро нависед.\n\nПаём ба дастгирии Ruznamo меравад.',
  supportExit: '❌ Анҷом додани муроҷиат',
  supportExited: 'Муроҷиат анҷом ёфт. Боз /support-ро истифода баред.',
  supportDirectContact: 'Ба роҳбарӣ дар Telegram навиштан',
  supportPhoneLabel: (phone) => `Телефони дастгирӣ: ${phone}`,
  sourceTelegram: 'Telegram',
  sourceManual: 'Аз тарафи маъмур',
  sourceUnknown: 'Номаълум',
  help: 'Менюи фармонҳои Telegram ё /instruction барои дастури пурра.',
  supportRelayed: 'Паёми шумо ба маъмур фиристода шуд. Лутфан интизор шавед.',
  supportRelayUnavailable: 'Дастгирии муваққатан дастнорас аст. Лутфан дертар кӯшиш кунед.',
  supportAttachmentRelayed: 'Файли шумо ба маъмур фиристода шуд. Лутфан интизор шавед.',
  supportReplyFromAdmin: (body) =>
    body ? `💬 Ҷавоби дастгирӣ:\n\n${body}` : '💬 Ҷавоби дастгирӣ',
  adminSupportReplyTargetUnknown: 'Гирандаи ин ҷавоб муайян нашуд.',
  unsupportedAttachment: 'Ин намуди файл дастгирӣ намешавад. Лутфан акс ё PDF-и чек фиристед.',
  replyBuyLicense: '🛒 Харидани иҷозатнома',
  replyMyLicenses: '🔑 Иҷозатномаҳои ман',
  replySupport: '💬 Дастгирӣ',
  replyLanguage: '🌐 Забон',
  replyMainMenu: '🏠 Менюи асосӣ',
  menuLanguage: '🌐 Забон',
  menuMyKey: '🔑 Калиди ман',
  menuMySub: '📋 Обунаи ман',
  menuHelp: '❓ Кӯмак',
  menuGetKey: '🔑 Калид гирифтан',
  menuRetry: '🔄 Аз нав кӯшиш кардан',
  menuBack: '⬅️ Бозгашт',
  adminWelcome: 'Шумо ҳамчун маъмур ворид шудед. /admin ё менюи фармонҳо.',
  adminUnauthorized: 'Иҷозати дастрасӣ нест.',
  adminApprovedDuplicate: 'Ин ариза аллакай тасдиқ шудааст.',
  adminRejectedDuplicate: 'Ин ариза аллакай рад шудааст.',
  linkConfirmPrompt: (plan, expiresAt, maskedKey, deviceLabel) =>
    `Ин ҳисоби Telegram-ро ба иҷозатномаи Ruznamo пайваст кунед?\n\n` +
    `Тариф: ${plan}\n` +
    `То: ${expiresAt}\n` +
    `Калид: ${maskedKey}\n` +
    `Дастгоҳ: ${deviceLabel}`,
  linkConfirmButton: '✅ Пайваст кардан',
  linkCancelButton: '❌ Бекор',
  linkSuccess: '✅ Ҳисоби Telegram ба иҷозатнома пайваст шуд.',
  linkAlreadyLinked: 'ℹ️ Ин ҳисоби Telegram аллакай пайваст аст.',
  linkHolderConflict: '❌ Иҷозатнома аз тарафи Telegram-и дигар идора мешавад. Ба дастгирӣ муроҷиат кунед.',
  linkExpired: '❌ Пайванди пайвасткунӣ нодуруст ё анҷом ёфтааст.',
  replacementConfirmPrompt: (oldDevice, newDevice) =>
    `Дастгоҳи кӯҳнаро хомӯш карда, наверо иҷозат диҳед?\n\n` +
    `Кӯҳна: ${oldDevice}\n` +
    `Нав: ${newDevice}`,
  replacementConfirmButton: '✅ Иваз кардани дастгоҳ',
  replacementSuccess: '✅ Дастгоҳ иваз шуд. Дастгоҳи нав метавонад иҷозатномаро истифода барад.',
  licenseDevicesTitle: '📱 Дастгоҳҳо',
  revokeDeviceButton: 'Хомӯш кардани дастгоҳ',
  revokeDeviceConfirm: 'Хомӯш кардани дастгоҳро аз ин иҷозатнома тасдиқ кунед.',
  deviceRevoked: '✅ Дастгоҳ хомӯш карда шуд.',
  licenseControlSection: '🔐 Идораи иҷозатнома',
  telegramAuthOtp: (code) =>
    `🔐 Тасдиқи Ruznamo\n\n` +
    `Рамзи тасдиқ:\n${code}\n\n` +
    `Ин рамзро дар барномаи Ruznamo ворид кунед.\n\n` +
    `Рамз 5 дақиқа эътибор дорад.\n\n` +
    `Ин рамзро ба касе надиҳед.`,
  telegramAuthChallengeUsed: '❌ Ин пайванд аллакай истифода шудааст ё анҷом ёфтааст.',
  telegramAuthChallengeExpired: '❌ Ин пайванд аллакай истифода шудааст ё анҷом ёфтааст.',
  telegramAuthNoLicenses:
    'Ба ин ҳисоби Telegram ягон иҷозатномаи Ruznamo пайваст нашудааст.',
  mainMenuTitle: '🏠 Менюи асосии Ruznamo',
  replyRecoverAccess: '♻️ Барқарор кардани дастрасӣ',
  recoverAccessBody:
    'Барои барқарор кардани дастрасӣ барномаи Ruznamo дар Android → «Барқарор кардани дастрасӣ» → тасдиқи шахсият тавассути ин бот.',
  replyAdminMenu: '🛠 Менюи маъмур',
  stopAcknowledged: 'Амали ҷорӣ қатъ шуд.',
  adminMenuTitle: '🛠 Менюи маъмур',
  adminMenuOrders: '💳 Дархостҳои пардохт',
  adminMenuRequisites: '💳 Реквизитҳо',
  adminMenuSupport: '💬 Дастгирӣ',
  adminMenuLicenses: '🔑 Иҷозатномаҳо',
  adminMenuCreateLicense: '➕ Эҷоди иҷозатнома',
  adminSupportInboxTitle: '💬 Муроҷиатҳои кушода',
  adminSupportEmpty: 'Муроҷиати кушода нест.',
  adminSupportConversationTitle: (user) => `Муроҷиат: ${user}`,
  adminSupportReplyPrompt: 'Ҷавобро ворид кунед ё Reply ба паёми чат.',
  adminSupportClosed: '✅ Муроҷиат пӯшида шуд.',
};
