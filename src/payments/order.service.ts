import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AuditActorType,
  BillingPeriod,
  OrderStatus,
  ReceiptStatus,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentConfigService } from './payment-config.service';

@Injectable()
export class OrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentConfig: PaymentConfigService,
    private readonly auditService: AuditService,
  ) {}

  async findOrCreatePendingOrder(userId: string, billingPeriod: BillingPeriod) {
    const existing = await this.prisma.order.findFirst({
      where: {
        userId,
        status: OrderStatus.PENDING,
        billingPeriod,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existing) {
      return existing;
    }

    const quote = await this.paymentConfig.getStandardPrice(billingPeriod);
    const order = await this.prisma.order.create({
      data: {
        userId,
        planId: quote.planId,
        billingPeriod,
        amount: quote.amount,
        currency: quote.currency,
        status: OrderStatus.PENDING,
      },
    });

    await this.auditService.log({
      actorType: AuditActorType.TELEGRAM_BOT,
      actorId: userId,
      action: 'telegram.order.created',
      entityType: 'Order',
      entityId: order.id,
      metadata: { billingPeriod },
    });

    return order;
  }

  async markAwaitingReceipt(orderId: string, userId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId, status: OrderStatus.PENDING },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return this.prisma.order.update({
      where: { id: order.id },
      data: { awaitingReceipt: true },
    });
  }

  async findAwaitingReceiptOrder(userId: string) {
    return this.prisma.order.findFirst({
      where: {
        userId,
        status: OrderStatus.PENDING,
        awaitingReceipt: true,
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async submitReceipt(input: {
    orderId: string;
    userId: string;
    telegramFileId: string;
    fileType: 'photo' | 'document';
    telegramUpdateId: bigint;
  }) {
    const existingByUpdate = await this.prisma.receipt.findUnique({
      where: { telegramUpdateId: input.telegramUpdateId },
      include: { order: true },
    });

    if (existingByUpdate) {
      return { receipt: existingByUpdate, order: existingByUpdate.order, duplicate: true };
    }

    const order = await this.prisma.order.findFirst({
      where: {
        id: input.orderId,
        userId: input.userId,
        status: { in: [OrderStatus.PENDING, OrderStatus.RECEIPT_SUBMITTED] },
        awaitingReceipt: true,
      },
    });

    if (!order) {
      throw new BadRequestException('No eligible order awaiting receipt');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const receipt = await tx.receipt.create({
        data: {
          orderId: order.id,
          telegramFileId: input.telegramFileId,
          fileType: input.fileType,
          telegramUpdateId: input.telegramUpdateId,
          status: ReceiptStatus.PENDING,
        },
      });

      const updatedOrder = await tx.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.UNDER_REVIEW,
          awaitingReceipt: false,
        },
      });

      return { receipt, order: updatedOrder };
    });

    await this.auditService.log({
      actorType: AuditActorType.TELEGRAM_BOT,
      actorId: input.userId,
      action: 'telegram.receipt.submitted',
      entityType: 'Receipt',
      entityId: result.receipt.id,
      metadata: { orderId: order.id },
    });

    return { ...result, duplicate: false };
  }

  async getOrderForAdminReview(orderId: string) {
    return this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        plan: true,
        user: { include: { telegramAccount: true } },
        receipts: { orderBy: { submittedAt: 'desc' }, take: 1 },
        license: true,
      },
    });
  }
}
