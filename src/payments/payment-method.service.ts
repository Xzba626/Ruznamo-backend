import { Injectable, NotFoundException } from '@nestjs/common';
import { PaymentMethodType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface CreatePaymentMethodInput {
  name: string;
  type: PaymentMethodType;
  paymentValue: string;
  recipientName: string;
  sortOrder?: number;
}

@Injectable()
export class PaymentMethodService {
  constructor(private readonly prisma: PrismaService) {}

  listActive() {
    return this.prisma.paymentMethod.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  listAll() {
    return this.prisma.paymentMethod.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async getActiveById(id: string) {
    const method = await this.prisma.paymentMethod.findFirst({
      where: { id, isActive: true },
    });
    if (!method) {
      throw new NotFoundException('Payment method not found or inactive');
    }
    return method;
  }

  async getById(id: string) {
    const method = await this.prisma.paymentMethod.findUnique({ where: { id } });
    if (!method) {
      throw new NotFoundException('Payment method not found');
    }
    return method;
  }

  create(input: CreatePaymentMethodInput) {
    return this.prisma.paymentMethod.create({
      data: {
        name: input.name.trim(),
        type: input.type,
        paymentValue: input.paymentValue.trim(),
        recipientName: input.recipientName.trim(),
        sortOrder: input.sortOrder ?? 0,
        isActive: true,
      },
    });
  }

  async update(
    id: string,
    input: Partial<CreatePaymentMethodInput> & { isActive?: boolean },
  ) {
    await this.getById(id);
    const data: Prisma.PaymentMethodUpdateInput = {};
    if (input.name !== undefined) data.name = input.name.trim();
    if (input.type !== undefined) data.type = input.type;
    if (input.paymentValue !== undefined) data.paymentValue = input.paymentValue.trim();
    if (input.recipientName !== undefined) data.recipientName = input.recipientName.trim();
    if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;
    if (input.isActive !== undefined) data.isActive = input.isActive;

    return this.prisma.paymentMethod.update({ where: { id }, data });
  }

  async setActive(id: string, isActive: boolean) {
    return this.update(id, { isActive });
  }

  async safeDelete(id: string) {
    const referenced = await this.prisma.order.count({ where: { paymentMethodId: id } });
    if (referenced > 0) {
      return this.setActive(id, false);
    }
    return this.prisma.paymentMethod.delete({ where: { id } });
  }
}
