import {
  CUSTOM_REJECTION_REASON_MAX_LEN,
  PAYMENT_REJECTION_REASON_CODES,
  PaymentRejectionReasonCode,
  parsePaymentRejectionReasonCode,
  rejectionReasonCustomerText,
  rejectionReasonLabel,
  sanitizeCustomRejectionReason,
} from './rejection-reason';

describe('payment rejection reasons', () => {
  it('exposes 12 stable codes including OTHER', () => {
    expect(PAYMENT_REJECTION_REASON_CODES).toHaveLength(12);
    expect(PAYMENT_REJECTION_REASON_CODES).toContain(PaymentRejectionReasonCode.OTHER);
    expect(PAYMENT_REJECTION_REASON_CODES).toContain(PaymentRejectionReasonCode.AMOUNT_MISMATCH);
  });

  it('parses known codes and rejects unknown', () => {
    expect(parsePaymentRejectionReasonCode('amount_mismatch')).toBe(
      PaymentRejectionReasonCode.AMOUNT_MISMATCH,
    );
    expect(parsePaymentRejectionReasonCode('FAKE_CHEQUE')).toBeNull();
  });

  it('labels RU and TJ without raw enum leakage', () => {
    expect(rejectionReasonLabel(PaymentRejectionReasonCode.RECEIPT_SUSPICIOUS, 'RU')).toContain(
      'подлинность',
    );
    expect(rejectionReasonLabel(PaymentRejectionReasonCode.RECEIPT_SUSPICIOUS, 'TJ')).toContain(
      'Аслият',
    );
    expect(rejectionReasonLabel(PaymentRejectionReasonCode.AMOUNT_MISMATCH, 'RU')).not.toBe(
      'AMOUNT_MISMATCH',
    );
  });

  it('uses custom text for OTHER customer message', () => {
    expect(
      rejectionReasonCustomerText(PaymentRejectionReasonCode.OTHER, '  Сумма другая  ', 'RU'),
    ).toBe('Сумма другая');
    expect(
      rejectionReasonCustomerText(PaymentRejectionReasonCode.AMOUNT_MISMATCH, 'ignored', 'RU'),
    ).toBe(rejectionReasonLabel(PaymentRejectionReasonCode.AMOUNT_MISMATCH, 'RU'));
  });

  it('sanitizes custom reason length', () => {
    expect(sanitizeCustomRejectionReason('abc')).toBeNull();
    expect(sanitizeCustomRejectionReason('  ok reason  ')).toBe('ok reason');
    const huge = 'x'.repeat(CUSTOM_REJECTION_REASON_MAX_LEN + 50);
    expect(sanitizeCustomRejectionReason(huge)?.length).toBe(CUSTOM_REJECTION_REASON_MAX_LEN);
  });
});
