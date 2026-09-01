import { AuditActorType } from '@prisma/client';
import { TelegramUpdateProcessor } from './telegram-update.processor';

describe('TelegramUpdateProcessor admin callbacks', () => {
  const prisma = {
    telegramProcessedUpdate: { create: jest.fn().mockResolvedValue({}) },
    order: { findFirst: jest.fn() },
    license: { findFirst: jest.fn() },
  };

  const configService = {
    get: jest.fn((key: string, fallback?: unknown) => {
      if (key === 'telegram.adminTelegramIds') return ['999'];
      return fallback;
    }),
  };

  const botApi = {
    answerCallbackQuery: jest.fn(),
    sendMessage: jest.fn(),
  };

  const paymentApprovalService = {
    approve: jest.fn(),
    reject: jest.fn(),
    getStoredLicenseKeyForUser: jest.fn(),
  };

  const auditService = { log: jest.fn() };

  const processor = new TelegramUpdateProcessor(
    prisma as never,
    configService as never,
    botApi as never,
    {} as never,
    { getOrderForAdminReview: jest.fn() } as never,
    paymentApprovalService as never,
    {} as never,
    {} as never,
    auditService as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects approve callback from non-admin telegram user', async () => {
    await (processor as unknown as { handleCallback: (u: unknown) => Promise<void> }).handleCallback({
      callback_query: {
        id: 'cb_1',
        data: 'approve:ord_1',
        from: { id: 111 },
        message: { chat: { id: 111 } },
      },
    });

    expect(paymentApprovalService.approve).not.toHaveBeenCalled();
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'telegram.admin.unauthorized' }),
    );
    expect(botApi.answerCallbackQuery).toHaveBeenCalled();
  });

  it('allows approve callback for configured admin telegram id', async () => {
    paymentApprovalService.approve.mockResolvedValue({
      orderId: 'ord_1',
      licenseId: 'lic_1',
      licenseKey: 'k'.repeat(64),
      expiresAt: new Date(),
      alreadyProcessed: false,
    });

    await (processor as unknown as { handleCallback: (u: unknown) => Promise<void> }).handleCallback({
      callback_query: {
        id: 'cb_2',
        data: 'approve:ord_1',
        from: { id: 999 },
        message: { chat: { id: 999 } },
      },
    });

    expect(paymentApprovalService.approve).toHaveBeenCalledWith(
      'ord_1',
      expect.objectContaining({
        actorType: AuditActorType.TELEGRAM_BOT,
        actorId: '999',
      }),
    );
  });
});
