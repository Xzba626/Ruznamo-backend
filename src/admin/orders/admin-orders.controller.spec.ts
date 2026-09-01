import { AdminOrdersController } from './admin-orders.controller';
import { AdminOrdersService } from './admin-orders.service';

describe('AdminOrdersController', () => {
  const ordersService = {
    list: jest.fn(),
    getById: jest.fn(),
    approve: jest.fn(),
    reject: jest.fn(),
  };

  const controller = new AdminOrdersController(ordersService as unknown as AdminOrdersService);
  const admin = { sub: 'adm_1', email: 'owner@test.local', roles: ['SUPER_ADMIN'], permissions: [] };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('approve passes admin id to service', async () => {
    ordersService.approve.mockResolvedValue({ orderId: 'ord_1', status: 'COMPLETED' });
    await controller.approve('ord_1', admin as never);
    expect(ordersService.approve).toHaveBeenCalledWith('ord_1', 'adm_1');
  });

  it('reject passes admin id and reason to service', async () => {
    ordersService.reject.mockResolvedValue({ orderId: 'ord_1', status: 'REJECTED' });
    await controller.reject('ord_1', admin as never, { reason: 'bad receipt' });
    expect(ordersService.reject).toHaveBeenCalledWith('ord_1', 'adm_1', 'bad receipt');
  });
});
