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

  it('getById throws when order missing', async () => {
    prisma.order.findUnique.mockResolvedValue(null);
    await expect(service.getById('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
