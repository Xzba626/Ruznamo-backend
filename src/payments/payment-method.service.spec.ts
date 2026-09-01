import { PaymentMethodType } from '@prisma/client';
import { PaymentMethodService } from './payment-method.service';

describe('PaymentMethodService', () => {
  const prisma = {
    paymentMethod: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    order: { count: jest.fn() },
  };

  const service = new PaymentMethodService(prisma as never);

  beforeEach(() => jest.clearAllMocks());

  it('lists active methods', async () => {
    prisma.paymentMethod.findMany.mockResolvedValue([{ id: 'pm_1', name: 'Alif' }]);
    const result = await service.listActive();
    expect(result).toHaveLength(1);
  });

  it('safe-deletes by disabling when referenced', async () => {
    prisma.paymentMethod.findUnique.mockResolvedValue({ id: 'pm_1' });
    prisma.order.count.mockResolvedValue(2);
    prisma.paymentMethod.update.mockResolvedValue({ id: 'pm_1', isActive: false });

    const result = await service.safeDelete('pm_1');
    expect(result.isActive).toBe(false);
  });

  it('creates payment method', async () => {
    prisma.paymentMethod.create.mockResolvedValue({ id: 'pm_1' });
    await service.create({
      name: 'Душанбе Сити',
      type: PaymentMethodType.PHONE,
      paymentValue: '900123456',
      recipientName: 'Иван Иванов',
    });
    expect(prisma.paymentMethod.create).toHaveBeenCalled();
  });
});
