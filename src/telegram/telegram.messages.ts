export const TG = {
  welcomeNoLicense: (name?: string) =>
    `Салом${name ? `, ${name}` : ''}!\n\nБарои истифодаи пурраи барнома калиди фаъол лозим аст.\n\nМӯҳлати обунаро интихоб кунед:`,
  welcomeActiveLicense: (expiresAt: string) =>
    `Салом!\n\nОбунаи шумо фаъол аст то: ${expiresAt}\n\nШумо метавонед калиди худро дубора бинед ё маълумоти обунаро санҷед.`,
  paymentInfo: (monthly: string, yearly: string, card: string, recipient: string, extra: string) =>
    `Пардохт барои обуна\n\n1 моҳ — ${monthly}\n1 сол — ${yearly}\n\nРақами корт/ҳисоб:\n\`${card}\`\n\nНоми қабулкунанда:\n${recipient}\n\n${extra}\n\nЛутфан маблағи заруриро пардохт кунед ва баъд тугмаи «Ман пардохт кардам»-ро пахш кунед.`,
  askReceipt: 'Лутфан акси чек ё файли тасдиқкунандаи пардохтро фиристед.',
  receiptReceived:
    '⏳ Санҷиши пардохт идома дорад.\n\nТасдиқот ба маъмурият фиристода шуд. Лутфан интизор шавед.',
  noAwaitingOrder: 'Аввал мӯҳлати обунаро интихоб кунед ва тугмаи «Ман пардохт кардам»-ро пахш кунед.',
  licenseApproved: (expiresAt: string, key: string) =>
    `✅ Пардохт тасдиқ шуд.\n\nОбунаи шумо фаъол шуд.\n\nМӯҳлат: ${expiresAt}\n\nКалиди фаъолсозӣ:\n\`${key}\`\n\nКалидро дар барномаи Ruznamo ворид кунед.`,
  licenseRejected:
    '❌ Пардохт тасдиқ нашуд.\n\nМаълумоти пардохтро санҷед ва кӯшишро такрор кунед.\n\nАгар пардохт нав анҷом дода шуда бошад, чанд дақиқа интизор шавед.',
  subscriptionInfo: (plan: string, expiresAt: string, prefix: string) =>
    `📋 Обунаи шумо\n\nТариф: ${plan}\nМӯҳлат то: ${expiresAt}\nПешнависи калид: ${prefix}...`,
  help:
    '❓ Кӯмак\n\n1. Мӯҳлатро интихоб кунед\n2. Пардохт кунед\n3. Чекро фиристед\n4. Калидро дар барнома фаъол созед',
  adminUnauthorized: 'Иҷозати дастрасӣ нест.',
  adminApprovedDuplicate: 'Ин ариза аллакай тасдиқ шудааст.',
  adminRejectedDuplicate: 'Ин ариза аллакай рад шудааст.',
  adminConnected: 'Telegram успешно подключён к админ-панели Ruznamo.',
  adminConnectExpired: 'Код подключения истёк. Создайте новый код в админ-панели.',
  adminConnectInvalid: 'Код подключения недействителен или уже использован.',
  adminConnectUnauthorized:
    'Код подключения недействителен или уже использован.',
  adminWelcome: 'Салом! Шумо ҳамчун маъмур шинохта шудед.',
  supportRelayed: 'Паёми шумо ба маъмур фиристода шуд. Лутфан интизор шавед.',
  supportRelayUnavailable:
    'Дастгирии муваққатан дастнорас аст. Лутфан дертар кӯшиш кунед.',
} as const;

export const CB = {
  PERIOD_MONTHLY: 'period:MONTHLY',
  PERIOD_YEARLY: 'period:YEARLY',
  ACTION_PAID: 'action:paid',
  ACTION_RETRY: 'action:retry',
  ACTION_MY_KEY: 'action:my_key',
  ACTION_MY_SUB: 'action:my_sub',
  ACTION_HELP: 'action:help',
  ACTION_GET_KEY: 'action:get_key',
  approve: (orderId: string) => `approve:${orderId}`,
  reject: (orderId: string) => `reject:${orderId}`,
} as const;

export function formatDateTj(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

export function formatAmount(amount: string, currency: string): string {
  return `${amount} ${currency === 'TJS' ? 'сомонӣ' : currency}`;
}
