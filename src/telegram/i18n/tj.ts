import type { TelegramI18n } from './telegram-i18n.types';

export const tj: TelegramI18n = {
  languageSelect: 'Забонро интихоб кунед / Выберите язык',
  languageButtonTj: '🇹🇯 Тоҷикӣ',
  languageButtonRu: '🇷🇺 Русский',
  languageChanged: '✅ Забон тағйир дода шуд.',
  userStartWelcome:
    'Хуш омадед ба Ruznamo.\n\n' +
    'Дар ин ҷо шумо метавонед иҷозатнома харед, дастрасиро барқарор кунед ва ба дастгирӣ муроҷиат кунед.',
  welcomeNoLicense: (name) => `Салом${name ? `, ${name}` : ''}!`,
  welcomeActiveLicense: (expiresAt) => `Иҷозатномаҳои фаъол. Анҷоми наздиктарин: ${expiresAt}`,
  choosePlan: 'Тарифро интихоб кунед:',
  planUnavailable: 'Ин тариф ҳоло барои харид дастрас нест.',
  purchaseUnavailable: 'Ҳоло харидани иҷозатнома муваққатан дастрас нест.',
  planStandardLabel: 'Standard',
  planProLabel: 'Pro',
  standardTariffCard: () =>
    `Standard\n\n` +
    `Дастрасии пурра ба имкониятҳои Ruznamo.\n\n` +
    `✓ Ҳамаи имкониятҳои барнома\n` +
    `✓ Бе реклама\n` +
    `✓ То 2 дастгоҳи фаъол ҳамзамон\n` +
    `✓ Калиди шахсии литсензия\n` +
    `✓ Воридшавӣ ва барқarorсозӣ тавассути Telegram\n` +
    `✓ Имкони барқaror ва нусхабардории калид\n` +
    `✓ Иваз кардани бехатари дастгоҳ\n` +
    `✓ Дастгирии Ruznamo`,
  standardDurationMonthButton: (price) => `1 моҳ · ${price}`,
  standardDurationYearButton: (price) => `1 сол · ${price}`,
  standardBuyButton: 'Харидани Standard',
  chooseDuration: (planName) => `Муддатро барои ${planName} интихоб кунед:`,
  duration30Days: (price) => `30 рӯз — ${price}`,
  duration365Days: (price) => `365 рӯз — ${price}`,
  durationUnavailable: 'Ин муддат ҳозир дастрас нест.',
  planStandard: (price, days) => `Standard\n${days} рӯз — ${price}`,
  planPro: (price, days) => `Pro\n${days} рӯз — ${price}`,
  paymentSummary: (planName, days, amount) =>
    `Тариф: ${planName}\nМӯҳлат: ${days} рӯз\nМаблағ: ${amount}`,
  choosePaymentMethod: 'Усули пардохтро интихоб кунед:',
  paymentInstructions: (methodName, planName, amount, days, paymentValue, recipient) =>
    `Усули пардохт: ${methodName}\n\nТариф: ${planName}\nМӯҳлат: ${days} рӯз\nМаблағ: ${amount}\n\nРеквизитҳо:\n\`${paymentValue}\`\n\nҚабулкунанда:\n${recipient}\n\nПас аз пардохт акси ё PDF-и чекро инҷо фиристед.`,
  askReceipt: 'Ҳоло тасдиқи пардохт интизор аст. Акси ё PDF-и чекро фиристед.',
  paymentAwaitingReceiptHint:
    'Ҳоло тасдиқи пардохт интизор аст. Акси ё PDF-и чекро фиристед.',
  invalidInputUseButtons: 'Лутфан варианти зеринро бо тугма интихоб кунед.',
  receiptReceived:
    '✅ Чек қабул шуд.\n\nСанҷиши пардохт идома дорад. Лутфан интизор шавед.',
  noAwaitingOrder: 'Аввал тарифро интихоб кунед, сонӣ чеки пардохтро фиристед.',
  paymentApproved: (planName, days, expiresAt, key) =>
    `✅ Пардохт тасдиқ шуд\n\nТариф: ${planName}\nМӯҳлат: ${days} рӯз\nТо: ${expiresAt}\n\nКалид:\n\`${key}\``,
  paymentRejected:
    '❌ Пардохт тасдиқ нашуд.\n\nЧеки нав фиристед ё тарифро аз нав интихоб кунед.',
  myLicensesTitle: '🔑 Иҷозатномаҳои ман',
  subscriptionInfo: (plan, days, expiresAt, maskedKey) =>
    `Тариф: ${plan}\nМӯҳлат: ${days} рӯз\nТо: ${expiresAt}\nКалид: ${maskedKey}`,
  licenseListItem: (plan, status, expiresAt, devicesUsed, deviceLimit, source, maskedKey) =>
    `${plan}\nҲолат: ${status}\nТо: ${expiresAt}\nДастгоҳҳо: ${devicesUsed} аз ${deviceLimit}\nМанбаъ: ${source}\nКалид: ${maskedKey}`,
  noActiveLicense: 'Ҳоло иҷозатнома нест. «Харидани иҷозатнома»-ро пахш кунед.',
  instructionTitle: '📖 Дастур',
  instructionBody:
    '1. «Харидани иҷозатнома»-ро пахш кунед.\n' +
    '2. Муддатро интихоб кунед.\n' +
    '3. Усули пардохтро интихоб кунед.\n' +
    '4. Чекро фиристед.\n' +
    '5. Калидро гиред ва дар Ruznamo ворид кунед.',
  supportWelcome:
    'Дастгирии Ruznamo\n\n' +
    'Савол ё мушкилиятро нависед.\n' +
    'Матн, акс ё ҳуҷҷат фиристед.\n' +
    'Маъмур дар ин ҷо ҷавоб медиҳад.',
  supportCategoryPrompt: 'Мавзӯи муроҷиатро интихоб кунед:',
  supportCategoryTechnical: 'Мушкилияти техникӣ',
  supportCategoryLicense: 'Иҷозатнома / калид',
  supportCategoryPayment: 'Пардохт',
  supportCategoryDevice: 'Дастгоҳ',
  supportCategoryOther: 'Дигар',
  supportCategoryLabel: (category) => {
    const map: Record<string, string> = {
      technical: 'Мушкилияти техникӣ',
      license: 'Иҷозатнома / калид',
      payment: 'Пардохт',
      device: 'Дастгоҳ',
      other: 'Дигар',
    };
    return map[category] ?? category;
  },
  supportMessageSent: '✅ Паём ба маъмур фиристода шуд.\nИнтизор шавед.',
  supportCloseConfirm: 'Ин муроҷиатро пӯшед?',
  supportCloseConfirmYes: 'Бале, пӯшидан',
  supportCloseConfirmNo: 'Идома додан',
  supportClosedFinal: 'Муроҷиат пӯшида шуд. Агар лозим шавад, муроҷиати нав кушоед.',
  supportExit: '✖️ Анҷом додани муроҷиат',
  supportExited: 'Муроҷиат анҷом ёфт.',
  supportDirectContact: 'Ба роҳбарӣ дар Telegram',
  supportPhoneLabel: (phone) => `Телефони дастгирӣ: ${phone}`,
  sourceTelegram: 'Telegram',
  sourceManual: 'Аз тарафи маъмур',
  sourceUnknown: 'Номаълум',
  help: 'Менюи фармонҳо ё /instruction.',
  supportRelayed: '✅ Фиристода шуд.',
  supportRelayUnavailable: 'Дастгирӣ муваққатан дастнорас аст.',
  supportAttachmentRelayed: '✅ Фиристода шуд.',
  supportReplyFromAdmin: (body) =>
    body ? `💬 Дастгирии Ruznamo\n\n${body}` : '💬 Дастгирии Ruznamo',
  adminSupportReplyTargetUnknown: 'Гиранда муайян нашуд.',
  unsupportedAttachment: 'Ин намуди файл дастгирӣ намешавад.',
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
  menuRetry: '🔄 Аз нав',
  menuBack: '⬅️ Бозгашт',
  adminWelcome: 'Шумо ҳамчун маъмур ворид шудед.',
  adminUnauthorized: 'Иҷозат дастрас нест.',
  adminApprovedDuplicate: 'Аллакай тасдиқ шудааст.',
  adminRejectedDuplicate: 'Аллакай рад шудааст.',
  linkConfirmPrompt: (plan, expiresAt, maskedKey, deviceLabel) =>
    `Пайваст кардани Telegram ба иҷозатнома?\n\nТариф: ${plan}\nТо: ${expiresAt}\nКалид: ${maskedKey}\nДастгоҳ: ${deviceLabel}`,
  linkConfirmButton: '✅ Пайваст кардан',
  linkCancelButton: '❌ Бекор',
  linkSuccess: '✅ Пайваст шуд.',
  linkAlreadyLinked: 'ℹ️ Аллакай пайваст аст.',
  linkHolderConflict: '❌ Иҷозатнома аз Telegram-и дигар идора мешавад.',
  linkExpired: '❌ Пайванд нодуруст ё анҷом ёфтааст.',
  replacementConfirmPrompt: (oldDevice, newDevice) =>
    `Дастгоҳи кӯҳнаро хомӯш кунед?\n\nКӯҳна: ${oldDevice}\nНав: ${newDevice}`,
  replacementConfirmButton: '✅ Иваз кардан',
  replacementSuccess: '✅ Дастгоҳ иваз шуд.',
  licenseDevicesTitle: '📱 Дастгоҳҳо',
  revokeDeviceButton: 'Хомӯш кардан',
  revokeDeviceConfirm: 'Хомӯш кардани дастгоҳро тасдиқ кунед.',
  deviceRevoked: '✅ Хомӯш шуд.',
  licenseControlSection: '🔐 Идора',
  telegramAuthOtp: (code) =>
    `Рамзи тасдиқ:\n\n${code}\n\n5 дақиқа эътибор дорад.\nБа касе надиҳед.`,
  telegramAuthOtpRecovery: (code) =>
    `Барқaror кардани дастрасӣ\n\nРамзи тасдиқ:\n\n${code}\n\n5 дақиқа эътибор дорад.\nБа касе надиҳед.`,
  telegramAuthOtpLink: (code) =>
    `Пайвасткунии Telegram\n\nРамзи тасдиқ:\n\n${code}\n\n5 дақиқа эътибор дорад.\nБа касе надиҳед.`,
  telegramAuthCopyCode: '📋 Нусхабардории рамз',
  telegramAuthChallengeUsed: '❌ Пайванд аллакай истифода шудааст.',
  telegramAuthChallengeExpired: '❌ Пайванд анҷом ёфтааст.',
  telegramAuthNoLicenses: 'Иҷозатнома пайваст нест.',
  mainMenuTitle: '🏠 Менюи асосии Ruznamo',
  replyRecoverAccess: '♻️ Барқaror кардани дастрасӣ',
  recoverAccessBody:
    'Барои бехатар барқaror кардани дастрасӣ: Ruznamo → Танзимот → Иҷозатнома → Калиди дастрасӣ → Барқaror кардани дастрасӣ.',
  replyAdminMenu: '🛠 Менюи маъмур',
  stopAcknowledged: 'Амали ҷорӣ қатъ шуд.',
  adminRootTitle: 'Панели маъмури Ruznamo',
  adminMenuTitle: '🛠 Панели маъмур',
  adminMenuOrders: '💳 Дархостҳои пардохт',
  adminMenuRequisites: '💰 Реквизитҳо',
  adminMenuSupport: '💬 Дастгирӣ',
  adminMenuLicenses: '🔑 Иҷозатномаҳо',
  adminMenuCreateLicense: '➕ Эҷоди иҷозатнома',
  adminSupportInboxTitle: '💬 Муроҷиатҳои кушода',
  adminSupportEmpty: 'Муроҷиати кушода нест.',
  adminSupportConversationTitle: (user) => `Муроҷиат: ${user}`,
  adminSupportReplyButton: '✍️ Ҷавоб додан',
  adminSupportReplySent: '✅ Ҷавоб фиристода шуд.',
  adminSupportReplyCancel: 'Бекор',
  adminSupportBackToList: '⬅️ Ба рӯйхат',
  adminSupportDetailTitle: (ticket) => `Муроҷиат #${ticket}`,
  adminSupportInboxCount: (count) => `Муроҷиатҳои кушода: ${count}`,
  adminSupportInboxRow: (ticket, user, category, preview) =>
    `#${ticket} · ${user}\n${category}\n«${preview}»`,
  adminCreateLicenseTitle: 'Эҷоди иҷозатнома',
  adminCreateLicenseConfirm: (plan, period) =>
    `${plan}\nМуддат: ${period}\nМанбаъ: дастӣ\n\nЭҷод кунем?`,
  adminCreateLicenseSuccess: (plan, expiresAt, key) =>
    `✅ Эҷод шуд\n\n${plan}\nТо: ${expiresAt}\n\nКалид:\n\`${key}\``,
  adminCopyKeyButton: '📋 Нусхабардории калид',
  adminSupportReplyPrompt: 'Ҷавобро нависед.\nМатн, акс ё ҳуҷҷат.',
  adminSupportClosed: '✅ Муроҷиат пӯшида шуд.',
};
