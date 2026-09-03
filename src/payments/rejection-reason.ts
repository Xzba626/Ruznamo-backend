/**
 * Stable payment-rejection reason codes for Admin Telegram + analytics.
 * Localized labels are never stored as machine identity.
 */

export const PaymentRejectionReasonCode = {
  RECEIPT_UNREADABLE: 'RECEIPT_UNREADABLE',
  PAYMENT_NOT_FOUND: 'PAYMENT_NOT_FOUND',
  AMOUNT_MISMATCH: 'AMOUNT_MISMATCH',
  WRONG_RECIPIENT: 'WRONG_RECIPIENT',
  RECEIPT_DATA_MISMATCH: 'RECEIPT_DATA_MISMATCH',
  DUPLICATE_RECEIPT: 'DUPLICATE_RECEIPT',
  PAYMENT_CANCELLED: 'PAYMENT_CANCELLED',
  INCOMPLETE_RECEIPT: 'INCOMPLETE_RECEIPT',
  WRONG_PAYMENT_METHOD: 'WRONG_PAYMENT_METHOD',
  PAYMENT_PENDING: 'PAYMENT_PENDING',
  RECEIPT_SUSPICIOUS: 'RECEIPT_SUSPICIOUS',
  OTHER: 'OTHER',
} as const;

export type PaymentRejectionReasonCode =
  (typeof PaymentRejectionReasonCode)[keyof typeof PaymentRejectionReasonCode];

export const PAYMENT_REJECTION_REASON_CODES: PaymentRejectionReasonCode[] = [
  PaymentRejectionReasonCode.RECEIPT_UNREADABLE,
  PaymentRejectionReasonCode.PAYMENT_NOT_FOUND,
  PaymentRejectionReasonCode.AMOUNT_MISMATCH,
  PaymentRejectionReasonCode.WRONG_RECIPIENT,
  PaymentRejectionReasonCode.RECEIPT_DATA_MISMATCH,
  PaymentRejectionReasonCode.DUPLICATE_RECEIPT,
  PaymentRejectionReasonCode.PAYMENT_CANCELLED,
  PaymentRejectionReasonCode.INCOMPLETE_RECEIPT,
  PaymentRejectionReasonCode.WRONG_PAYMENT_METHOD,
  PaymentRejectionReasonCode.PAYMENT_PENDING,
  PaymentRejectionReasonCode.RECEIPT_SUSPICIOUS,
  PaymentRejectionReasonCode.OTHER,
];

const LABELS_RU: Record<PaymentRejectionReasonCode, string> = {
  RECEIPT_UNREADABLE: 'Чек плохо читается',
  PAYMENT_NOT_FOUND: 'Оплата не найдена',
  AMOUNT_MISMATCH: 'Неверная сумма',
  WRONG_RECIPIENT: 'Оплата на другие реквизиты',
  RECEIPT_DATA_MISMATCH: 'Данные чека не совпадают',
  DUPLICATE_RECEIPT: 'Этот чек уже использован',
  PAYMENT_CANCELLED: 'Платёж отменён или возвращён',
  INCOMPLETE_RECEIPT: 'На чеке недостаточно данных',
  WRONG_PAYMENT_METHOD: 'Неверный способ оплаты',
  PAYMENT_PENDING: 'Оплата ещё не подтверждена',
  RECEIPT_SUSPICIOUS: 'Не удалось подтвердить подлинность чека',
  OTHER: 'Другая причина',
};

const LABELS_TJ: Record<PaymentRejectionReasonCode, string> = {
  RECEIPT_UNREADABLE: 'Расид равшан хонда намешавад',
  PAYMENT_NOT_FOUND: 'Пардохт ёфт нашуд',
  AMOUNT_MISMATCH: 'Маблағ нодуруст аст',
  WRONG_RECIPIENT: 'Пардохт ба реквизитҳои дигар фиристода шудааст',
  RECEIPT_DATA_MISMATCH: 'Маълумоти расид мувофиқат намекунад',
  DUPLICATE_RECEIPT: 'Ин расид аллакай истифода шудааст',
  PAYMENT_CANCELLED: 'Пардохт бекор ё баргардонида шудааст',
  INCOMPLETE_RECEIPT: 'Дар расид маълумоти кофӣ нест',
  WRONG_PAYMENT_METHOD: 'Тарзи пардохт нодуруст аст',
  PAYMENT_PENDING: 'Пардохт ҳоло тасдиқ нашудааст',
  RECEIPT_SUSPICIOUS: 'Аслияти расид тасдиқ нашуд',
  OTHER: 'Сабаби дигар',
};

/** Compact button labels for Telegram keyboard (RU). */
const BUTTON_RU: Record<PaymentRejectionReasonCode, string> = {
  RECEIPT_UNREADABLE: 'Чек плохо читается',
  PAYMENT_NOT_FOUND: 'Оплата не найдена',
  AMOUNT_MISMATCH: 'Неверная сумма',
  WRONG_RECIPIENT: 'Другие реквизиты',
  RECEIPT_DATA_MISMATCH: 'Данные не совпадают',
  DUPLICATE_RECEIPT: 'Чек уже использован',
  PAYMENT_CANCELLED: 'Платёж отменён',
  INCOMPLETE_RECEIPT: 'Недостаточно данных',
  WRONG_PAYMENT_METHOD: 'Неверный способ',
  PAYMENT_PENDING: 'Оплата не подтверждена',
  RECEIPT_SUSPICIOUS: 'Подлинность не подтверждена',
  OTHER: '✍️ Другая причина',
};

const GUIDANCE_RU: Partial<Record<PaymentRejectionReasonCode, string>> = {
  RECEIPT_UNREADABLE:
    'Если оплата была выполнена правильно, отправьте новый, более чёткий чек при следующей заявке.',
  PAYMENT_NOT_FOUND: 'Проверьте реквизиты и сумму перевода, затем создайте новую заявку.',
  AMOUNT_MISMATCH: 'Переведите точную сумму тарифа и создайте новую заявку с новым чеком.',
  WRONG_RECIPIENT: 'Оплатите по актуальным реквизитам Ruznamo и создайте новую заявку.',
  PAYMENT_PENDING: 'Дождитесь подтверждения перевода банком и повторите попытку позже.',
};

const GUIDANCE_TJ: Partial<Record<PaymentRejectionReasonCode, string>> = {
  RECEIPT_UNREADABLE:
    'Агар пардохт дуруст анҷом шуда бошад, дар дархости нав расиди равшантар фиристед.',
  PAYMENT_NOT_FOUND: 'Реквизитҳо ва маблағро санҷед, сипас дархости нав эҷод кунед.',
  AMOUNT_MISMATCH: 'Маблағи дақиқи тарифро пардохт карда, дархости нав эҷод кунед.',
  WRONG_RECIPIENT: 'Тибқи реквизитҳои ҷории Ruznamo пардохт кунед ва дархости нав эҷод кунед.',
  PAYMENT_PENDING: 'То тасдиқи бонк интизор шавед ва баъдтар такрор кунед.',
};

export function parsePaymentRejectionReasonCode(
  value: string | null | undefined,
): PaymentRejectionReasonCode | null {
  if (!value) return null;
  const normalized = value.trim().toUpperCase();
  return (PAYMENT_REJECTION_REASON_CODES as string[]).includes(normalized)
    ? (normalized as PaymentRejectionReasonCode)
    : null;
}

export function rejectionReasonLabel(
  code: PaymentRejectionReasonCode,
  lang: 'RU' | 'TJ',
): string {
  return lang === 'TJ' ? LABELS_TJ[code] : LABELS_RU[code];
}

export function rejectionReasonButtonLabel(code: PaymentRejectionReasonCode): string {
  return BUTTON_RU[code];
}

export function rejectionReasonCustomerText(
  code: PaymentRejectionReasonCode,
  customText: string | null | undefined,
  lang: 'RU' | 'TJ',
): string {
  if (code === PaymentRejectionReasonCode.OTHER && customText?.trim()) {
    return customText.trim();
  }
  return rejectionReasonLabel(code, lang);
}

export function rejectionReasonGuidance(
  code: PaymentRejectionReasonCode,
  lang: 'RU' | 'TJ',
): string | null {
  const map = lang === 'TJ' ? GUIDANCE_TJ : GUIDANCE_RU;
  return map[code] ?? null;
}

export const CUSTOM_REJECTION_REASON_MIN_LEN = 5;
export const CUSTOM_REJECTION_REASON_MAX_LEN = 500;

export function sanitizeCustomRejectionReason(raw: string): string | null {
  const trimmed = raw.replace(/\s+/g, ' ').trim();
  if (trimmed.length < CUSTOM_REJECTION_REASON_MIN_LEN) return null;
  if (trimmed.length > CUSTOM_REJECTION_REASON_MAX_LEN) {
    return trimmed.slice(0, CUSTOM_REJECTION_REASON_MAX_LEN);
  }
  return trimmed;
}
