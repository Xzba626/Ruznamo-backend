import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditActorType, BillingPeriod, LicenseStatus, OrderStatus } from '@prisma/client';
import { PaymentApprovalService } from './payment-approval.service';
import { LicenseKeyService } from '../security/license-key.service';
import { AuditService } from '../audit/audit.service';

describe('PaymentApprovalService', () => {
  const prisma = {
    order: { findUnique: jest.fn() },
    license: { create: jest.fn(), findUnique: jest.fn() },
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

  function mockTransaction() {
    prisma.$transaction.mockImplementation(async (cb: (tx: typeof prisma) => Promise<unknown>) =>
      cb({
        order: { findUnique: jest.fn().mockResolvedValue(order), update: jest.fn() },
        license: {
          create: jest.fn().mockResolvedValue({
            id: 'lic_1',
            expiresAt: new Date('2027-01-01'),
          }),
          findUnique: jest.fn(),
        },
        licenseEvent: { create: jest.fn() },
        receipt: { updateMany: jest.fn() },
        notificationOutbox: { create: jest.fn() },
      } as never),
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('approves under-review order and creates license inside transaction', async () => {
    mockTransaction();

    const result = await service.approve('ord_1', actor);

    expect(result.licenseKey).toHaveLength(64);
    expect(result.alreadyProcessed).toBe(false);
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'payment.approved' }),
    );
  });

  it('returns existing license on duplicate approve', async () => {
    prisma.$transaction.mockImplementation(async (cb: (tx: typeof prisma) => Promise<unknown>) =>
      cb({
        order: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'ord_1',
            userId: 'usr_1',
            license: { id: 'lic_1', expiresAt: new Date('2027-01-01') },
            receipts: [],
          }),
        },
      } as never),
    );
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

  it('treats unique orderId violation as duplicate approval', async () => {
    const uniqueError = new Prisma.PrismaClientKnownRequestError('Unique constraint', {
      code: 'P2002',
      clientVersion: '6.0.0',
    });

    prisma.$transaction.mockImplementation(async (cb: (tx: typeof prisma) => Promise<unknown>) =>
      cb({
        order: { findUnique: jest.fn().mockResolvedValue(order) },
        license: {
          create: jest.fn().mockRejectedValue(uniqueError),
          findUnique: jest.fn().mockResolvedValue({
            id: 'lic_existing',
            expiresAt: new Date('2027-06-01'),
          }),
        },
      } as never),
    );
    prisma.notificationOutbox.findFirst.mockResolvedValue({
      payload: { licenseKey: 'c'.repeat(64), userId: 'usr_1' },
    });

    const result = await service.approve('ord_1', actor);

    expect(result.alreadyProcessed).toBe(true);
    expect(result.licenseId).toBe('lic_existing');
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
    prisma.$transaction.mockImplementation(async (cb: (tx: typeof prisma) => Promise<unknown>) =>
      cb({
        order: {
          findUnique: jest.fn().mockResolvedValue({
            ...order,
            receipts: [],
          }),
        },
      } as never),
    );

    await expect(service.approve('ord_1', actor)).rejects.toBeInstanceOf(BadRequestException);
  });
});
