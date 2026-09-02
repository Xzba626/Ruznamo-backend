import { BadRequestException } from '@nestjs/common';
import { AuditActorType, BillingPeriod, LicenseIssueSource, OrderStatus } from '@prisma/client';
import { PaymentApprovalService } from './payment-approval.service';
import { AuditService } from '../audit/audit.service';
import { LicenseIssuanceService } from '../licenses/license-issuance.service';

describe('PaymentApprovalService', () => {
  const prisma = {
    order: { findUnique: jest.fn(), update: jest.fn() },
    license: { findUnique: jest.fn() },
    telegramAccount: { findUnique: jest.fn().mockResolvedValue(null) },
    receipt: { updateMany: jest.fn() },
    notificationOutbox: { create: jest.fn(), findFirst: jest.fn() },
    $transaction: jest.fn(),
  };

  const licenseIssuance = {
    issueLicense: jest.fn(),
  };

  const auditService = { log: jest.fn() };

  const service = new PaymentApprovalService(
    prisma as never,
    licenseIssuance as unknown as LicenseIssuanceService,
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

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.order.findUnique.mockResolvedValue(order);
    licenseIssuance.issueLicense.mockResolvedValue({
      licenseId: 'lic_1',
      licenseKey: 'a'.repeat(64),
      keyPrefix: 'aaaaaaaa',
      expiresAt: new Date('2027-01-01'),
      alreadyExisted: false,
    });
    prisma.$transaction.mockImplementation(async (cb: (tx: typeof prisma) => Promise<unknown>) =>
      cb({
        order: { update: jest.fn() },
        receipt: { updateMany: jest.fn() },
        notificationOutbox: { create: jest.fn() },
      } as never),
    );
  });

  it('approves under-review order via LicenseIssuanceService', async () => {
    const result = await service.approve('ord_1', actor);

    expect(licenseIssuance.issueLicense).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'ord_1',
        issueSource: LicenseIssueSource.TELEGRAM_PAYMENT,
      }),
    );
    expect(result.licenseKey).toHaveLength(64);
    expect(result.alreadyProcessed).toBe(false);
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'payment.approved' }),
    );
  });

  it('returns duplicate when order already has license', async () => {
    prisma.order.findUnique.mockResolvedValue({
      ...order,
      license: { id: 'lic_existing', expiresAt: new Date('2027-06-01'), keyPrefix: 'bbbbbbbb' },
    });
    prisma.notificationOutbox.findFirst.mockResolvedValue({
      payload: { licenseKey: 'stored-key', userId: 'usr_1' },
    });

    const result = await service.approve('ord_1', actor);

    expect(result.alreadyProcessed).toBe(true);
    expect(result.licenseKey).toBe('stored-key');
    expect(licenseIssuance.issueLicense).not.toHaveBeenCalled();
  });

  it('rejects ineligible order status', async () => {
    prisma.order.findUnique.mockResolvedValue({ ...order, status: OrderStatus.PENDING });

    await expect(service.approve('ord_1', actor)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects eligible under-review order', async () => {
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
    expect(licenseIssuance.issueLicense).not.toHaveBeenCalled();
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'payment.rejected' }),
    );
  });

  it('throws when approving order without receipt', async () => {
    prisma.order.findUnique.mockResolvedValue({
      ...order,
      receipts: [],
    });

    await expect(service.approve('ord_1', actor)).rejects.toBeInstanceOf(BadRequestException);
    expect(licenseIssuance.issueLicense).not.toHaveBeenCalled();
  });
});
