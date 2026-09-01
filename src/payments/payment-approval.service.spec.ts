import { BadRequestException } from '@nestjs/common';
import { AuditActorType, BillingPeriod, LicenseStatus, OrderStatus } from '@prisma/client';
import { PaymentApprovalService } from './payment-approval.service';
import { LicenseKeyService } from '../security/license-key.service';
import { AuditService } from '../audit/audit.service';

describe('PaymentApprovalService', () => {
  const prisma = {
    order: { findUnique: jest.fn(), update: jest.fn() },
    license: { create: jest.fn() },
    licenseEvent: { create: jest.fn() },
    receipt: { updateMany: jest.fn() },
    notificationOutbox: { create: jest.fn(), findFirst: jest.fn() },
    $transaction: jest.fn(),
  };

  const licenseKeyService = {
    generateRawKey: jest.fn().mockReturnValue('a'.repeat(64)),
    normalizeKey: jest.fn((k: string) => k),
    hashKey: jest.fn().mockReturnValue('hash'),
    prefix: jest.fn().mockReturnValue('aaaaaaaa'),
  };

  const auditService = { log: jest.fn() };

  const service = new PaymentApprovalService(
    prisma as never,
    licenseKeyService as unknown as LicenseKeyService,
    auditService as unknown as AuditService,
  );

  const actor = {
    actorType: AuditActorType.TELEGRAM_BOT,
    actorId: '123456789',
    telegramUserId: '123456789',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('approves under-review order and creates license', async () => {
    const order = {
      id: 'ord_1',
      userId: 'usr_1',
      planId: 'plan_1',
      billingPeriod: BillingPeriod.MONTHLY,
      status: OrderStatus.UNDER_REVIEW,
      license: null,
      receipts: [{ id: 'rcpt_1' }],
      plan: { id: 'plan_1' },
    };

    prisma.order.findUnique.mockResolvedValue(order);
    prisma.$transaction.mockImplementation(async (cb: (tx: typeof prisma) => Promise<unknown>) =>
      cb({
        license: {
          create: jest.fn().mockResolvedValue({
            id: 'lic_1',
            expiresAt: new Date('2027-01-01'),
          }),
        },
        licenseEvent: { create: jest.fn() },
        order: { update: jest.fn() },
        receipt: { updateMany: jest.fn() },
        notificationOutbox: { create: jest.fn() },
      } as never),
    );

    const result = await service.approve('ord_1', actor);

    expect(result.licenseKey).toHaveLength(64);
    expect(result.alreadyProcessed).toBe(false);
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'payment.approved' }),
    );
  });

  it('returns existing license on duplicate approve', async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: 'ord_1',
      userId: 'usr_1',
      license: { id: 'lic_1', expiresAt: new Date('2027-01-01') },
      receipts: [],
    });
    prisma.notificationOutbox.findFirst.mockResolvedValue({
      payload: { licenseKey: 'b'.repeat(64), userId: 'usr_1' },
    });

    const result = await service.approve('ord_1', actor);

    expect(result.alreadyProcessed).toBe(true);
    expect(result.licenseKey).toBe('b'.repeat(64));
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'payment.approve.duplicate' }),
    );
  });

  it('rejects eligible order', async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: 'ord_1',
      status: OrderStatus.UNDER_REVIEW,
    });
    prisma.$transaction.mockImplementation(async (cb: (tx: typeof prisma) => Promise<void>) =>
      cb({
        order: { update: jest.fn() },
        receipt: { updateMany: jest.fn() },
      } as never),
    );

    const result = await service.reject('ord_1', actor);
    expect(result.alreadyProcessed).toBe(false);
  });

  it('throws when approving order without receipt', async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: 'ord_1',
      userId: 'usr_1',
      status: OrderStatus.UNDER_REVIEW,
      license: null,
      receipts: [],
      plan: {},
    });

    await expect(service.approve('ord_1', actor)).rejects.toBeInstanceOf(BadRequestException);
  });
});
