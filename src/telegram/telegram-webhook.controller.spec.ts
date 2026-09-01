import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TelegramWebhookController } from './telegram-webhook.controller';
import { TelegramUpdateProcessor } from './telegram-update.processor';

describe('TelegramWebhookController', () => {
  const processor = { processUpdate: jest.fn() };
  const configService = {
    get: jest.fn((key: string) => {
      if (key === 'telegram.webhookSecret') return 'secret-token-123456';
      if (key === 'app.isProduction') return true;
      return undefined;
    }),
  };

  const controller = new TelegramWebhookController(
    processor as unknown as TelegramUpdateProcessor,
    configService as unknown as ConfigService,
  );

  it('rejects invalid webhook secret', async () => {
    await expect(
      controller.webhook('wrong', { body: { update_id: 1 } } as never),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('accepts valid webhook secret', async () => {
    const result = await controller.webhook('secret-token-123456', {
      body: { update_id: 1 },
    } as never);
    expect(result).toEqual({ ok: true });
    expect(processor.processUpdate).toHaveBeenCalled();
  });
});
