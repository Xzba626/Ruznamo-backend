import type { TelegramI18n } from './telegram-i18n.types';

export const tj: TelegramI18n = {
  languageSelect: 'Забонро интихоб кунед / Выберите язык',
  languageButtonTj: '🇹🇯 Тоҷикӣ',
  languageButtonRu: '🇷🇺 Русский',
  languageChanged: '✅ Забон тағйир дода шуд.',
  welcomeNoLicense: (name) =>
    `Салом${name ? `, ${name}` : ''}!\n\nБарои истифодаи пурраи барнома калиди фаъол лозим аст.`,
  welcomeActiveLicense: (expiresAt) =>
    `Салом!\n\nОбунаи шумо фаъол аст то: ${expiresAt}\n\nШумо метавонед калиди худро дубора бинед ё маълумоти обунаро санҷед.`,
  choosePlan: 'Тарифро интихоб кунед:',
  planStandardLabel: 'Standard',
  planProLabel: 'Pro',
  chooseDuration: (planName) => `Муддатро барои ${planName} интихоб кунед:`,
  duration30Days: (price) => `30 рӯз — ${price}`,
  duration365Days: (price) => `365 рӯз — ${price}`,
  durationUnavailable: 'Ин муддат ҳозир дастрас нест. Лутфан муддати дигарро интихоб кунед.',
  planStandard: (price, days) => `Standard\n${days} рӯз — ${price}`,
  planPro: (price, days) => `Pro\n${days} рӯз — ${price}`,
  paymentInstructions: (planName, amount, days, card, recipient, extra) =>
    `Пардохт барои ${planName}\n\nМӯҳлат: ${days} рӯз\nМаблағ: ${amount}\n\nРақами корт/ҳисоб:\n\`${card}\`\n\nНоми қабулкунанда:\n${recipient}\n\n${extra}\n\nЛутфан маблағро пардохт кунед ва акси ё файли чекро инҷо фиристед.`,
  askReceipt: 'Лутфан акси чек ё файли тасдиқкунандаи пардохтро фиристед.',
  receiptReceived:
    '✅ Чек қабул шуд.\n\nСанҷиши пардохт идома дорад. Лутфан интизор шавед — маъмурият чекро месанҷад.',
  noAwaitingOrder: 'Аввал тарифро интихоб кунед, сонӣ чеки пардохтро фиристед.',
  paymentApproved: (key, days, expiresAt) =>
    `✅ Пардохти шумо тасдиқ шуд.\n\nКалиди иҷозатномаи шумо:\n\`${key}\`\n\nМуҳлат: ${days} рӯз (то ${expiresAt})\n\nКалидро дар барномаи Ruznamo ворид кунед.`,
  paymentRejected:
    '❌ Пардохт тасдиқ нашуд.\n\nЛутфан пардохтро санҷед ва чеки нав фиристед ё тарифро аз нав интихоб кунед.',
  subscriptionInfo: (plan, expiresAt, prefix) =>
    `📋 Обунаи шумо\n\nТариф: ${plan}\nМӯҳлат то: ${expiresAt}\nПешнависи калид: ${prefix}...`,
  help:
    '❓ Кӯмак\n\n1. Тарифро интихоб кунед\n2. Пардохт кунед\n3. Чекро фиристед\n4. Калидро дар барнома фаъол созед',
  supportRelayed: 'Паёми шумо ба маъмур фиристода шуд. Лутфан интизор шавед.',
  supportRelayUnavailable: 'Дастгирии муваққатан дастнорас аст. Лутфан дертар кӯшиш кунед.',
  supportAttachmentRelayed: 'Файли шумо ба маъмур фиристода шуд. Лутфан интизор шавед.',
  unsupportedAttachment: 'Ин намуди файл дастгирӣ намешавад. Лутфан акс ё PDF-и чек фиристед.',
  menuLanguage: '🌐 Забон',
  menuMyKey: '🔑 Калиди ман',
  menuMySub: '📋 Обунаи ман',
  menuHelp: '❓ Кӯмак',
  menuGetKey: '🔑 Калид гирифтан',
  menuRetry: '🔄 Аз нав кӯшиш кардан',
  adminUnauthorized: 'Иҷозати дастрасӣ нест.',
  adminApprovedDuplicate: 'Ин ариза аллакай тасдиқ шудааст.',
  adminRejectedDuplicate: 'Ин ариза аллакай рад шудааст.',
};
