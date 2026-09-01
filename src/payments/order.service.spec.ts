import { BillingPeriod, OrderStatus, PlanCode } from '@prisma/client';
import { OrderService } from './order.service';
import { PaymentConfigService } from './payment-config.service';
import { AuditService } from '../audit/audit.service';

describe('OrderService', () => {
  const prisma = {
    order: { findFirst: jest.fn(), create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    plan: { findUnique: jest.fn() },
    receipt: { findUnique: jest.fn(), create: jest.fn() },
    $transaction: jest.fn(),
  };

  const paymentConfig = {
    getPlanPrice: jest.fn().mockResolvedValue({
      planId: 'plan_1',
      amount: '15.00',
      currency: 'TJS',
    }),
  };

  const auditService = { log: jest.fn() };

  const service = new OrderService(
    prisma as never,
    paymentConfig as unknown as PaymentConfigService,
    auditService as unknown as AuditService,
  );

  beforeEach(() => jest.clearAllMocks());

  it('reuses pending order for same plan and billing period', async () => {
    prisma.order.findFirst.mockResolvedValue({ id: 'ord_existing', status: OrderStatus.PENDING });

    const order = await service.findOrCreatePendingOrder('usr_1', 'plan_1', BillingPeriod.MONTHLY);

    expect(order.id).toBe('ord_existing');
    expect(prisma.order.create).not.toHaveBeenCalled();
  });

  it('starts payment flow and marks awaiting receipt', async () => {
    prisma.order.findFirst.mockResolvedValue({ id: 'ord_1', status: OrderStatus.PENDING });
    prisma.plan.findUnique.mockResolvedValue({ id: 'plan_1', code: PlanCode.STANDARD });
    prisma.order.update.mockResolvedValue({ id: 'ord_1', awaitingReceipt: true });

    const order = await service.startPaymentFlow('usr_1', 'plan_1', BillingPeriod.MONTHLY);

    expect(order.awaitingReceipt).toBe(true);
    expect(prisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { awaitingReceipt: true } }),
    );
  });

  it('ignores duplicate receipt by telegram update id', async () => {
    prisma.receipt.findUnique.mockResolvedValue({
      id: 'rcpt_1',
      order: { id: 'ord_1' },
    });

    const result = await service.submitReceipt({
      orderId: 'ord_1',
      userId: 'usr_1',
      telegramFileId: 'file_1',
      fileType: 'photo',
      telegramUpdateId: 100n,
    });

    expect(result.duplicate).toBe(true);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
