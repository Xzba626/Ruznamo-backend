import { TelegramLanguage } from '@prisma/client';
import { parseDurationCallback, parsePaymentCallback } from '../telegram.messages';
import { getTelegramI18n } from './index';

describe('telegram i18n', () => {
  it('returns Tajik messages by default', () => {
    const msgs = getTelegramI18n(null);
    expect(msgs.supportRelayed).toContain('Фиристода');
  });

  it('returns Russian messages for RU', () => {
    const msgs = getTelegramI18n(TelegramLanguage.RU);
    expect(msgs.supportRelayed).toContain('администратору');
  });
});

describe('parsePaymentCallback', () => {
  it('parses payment:approve prefix', () => {
    expect(parsePaymentCallback('payment:approve:ord_1')).toEqual({
      action: 'approve',
      orderId: 'ord_1',
    });
  });

  it('parses legacy approve prefix', () => {
    expect(parsePaymentCallback('approve:ord_1')).toEqual({
      action: 'approve',
      orderId: 'ord_1',
    });
  });
});

describe('parseDurationCallback', () => {
  it('parses duration callback', () => {
    expect(parseDurationCallback('duration:STANDARD:YEARLY')).toEqual({
      planCode: 'STANDARD',
      billingPeriod: 'YEARLY',
    });
  });
});
