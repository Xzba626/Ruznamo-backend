import { NotFoundException } from '@nestjs/common';
import { AdminOrdersService } from './admin-orders.service';
import { PaymentApprovalService } from '../../payments/payment-approval.service';

describe('AdminOrdersService', () => {
  const prisma = {
    order: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  const paymentApprovalService = {
    approve: jest.fn(),
    reject: jest.fn(),
  };

  const telegramLicenseDelivery = {
    deliverLicenseKey: jest.fn().mockResolvedValue(true),
  };

  const service = new AdminOrdersService(
    prisma as never,
    paymentApprovalService as unknown as PaymentApprovalService,
    telegramLicenseDelivery as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists orders with pagination', async () => {
    prisma.order.findMany.mockResolvedValue([]);
    prisma.order.count.mockResolvedValue(0);

    const result = await service.list({ page: 1, limit: 20 });

    expect(result.items).toEqual([]);
    expect(result.meta.total).toBe(0);
  });

  it('serializes telegram BigInt in list items', async () => {
    prisma.order.findMany.mockResolvedValue([
      {
        id: 'ord_1',
        status: 'PENDING',
        billingPeriod: 'MONTHLY',
        amount: { toString: () => '15.00' },
        currency: 'TJS',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        user: {
          id: 'usr_1',
          displayName: 'Buyer',
          email: null,
          telegramAccount: {
            telegramId: BigInt('999888777'),
            username: 'buyer',
            firstName: 'Buyer',
          },
        },
        plan: { code: 'STANDARD', name: 'Standard' },
        receipts: [{ id: 'rcpt_1', status: 'PENDING' }],
        license: null,
      },
    ]);
    prisma.order.count.mockResolvedValue(1);

    const result = await service.list({ page: 1, limit: 20 });

    expect(result.items[0].user?.telegramAccount?.telegramId).toBe('999888777');
  });

  it('approve delegates to PaymentApprovalService without exposing license key', async () => {
    paymentApprovalService.approve.mockResolvedValue({
      orderId: 'ord_1',
      userId: 'usr_1',
      licenseId: 'lic_1',
      licenseKey: 'secret-key-must-not-leak',
      expiresAt: new Date(),
      alreadyProcessed: false,
    });

    const result = await service.approve('ord_1', 'adm_1');

    expect(paymentApprovalService.approve).toHaveBeenCalledWith('ord_1', {
      actorType: 'ADMIN',
      actorId: 'adm_1',
    });
    expect(result).toEqual({
      orderId: 'ord_1',
      licenseId: 'lic_1',
      status: 'COMPLETED',
      alreadyProcessed: false,
    });
    expect(result).not.toHaveProperty('licenseKey');
  });

  it('reject delegates to PaymentApprovalService', async () => {
    paymentApprovalService.reject.mockResolvedValue({
      orderId: 'ord_1',
      alreadyProcessed: false,
    });

    const result = await service.reject('ord_1', 'adm_1', 'invalid receipt');

    expect(paymentApprovalService.reject).toHaveBeenCalledWith(
      'ord_1',
      { actorType: 'ADMIN', actorId: 'adm_1' },
      'invalid receipt',
    );
    expect(result.status).toBe('REJECTED');
  });

  it('getById returns null rejectionReasonCode for legacy rejected orders', async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: 'ord_old',
      status: 'REJECTED',
      billingPeriod: 'MONTHLY',
      amount: { toString: () => '20' },
      currency: 'TJS',
      createdAt: new Date(),
      approvedAt: null,
      rejectedAt: new Date(),
      rejectionReason: 'admin_rejected',
      rejectionReasonCode: null,
      paymentMethodName: 'Alif',
      paymentMethodType: 'PHONE',
      paymentMethodValue: '+992',
      paymentMethodRecipient: 'X',
      user: {
        id: 'usr_1',
        displayName: 'Buyer',
        email: null,
        telegramAccount: null,
      },
      plan: { code: 'STANDARD', name: 'Standard', features: [] },
      receipts: [],
      license: null,
    });

    const result = await service.getById('ord_old');
    expect(result.rejectionReasonCode).toBeNull();
    expect(result.rejectionReason).toBe('admin_rejected');
  });

  it('getById throws when order missing', async () => {
    prisma.order.findUnique.mockResolvedValue(null);
    await expect(service.getById('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
