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

  async findOrCreatePendingOrder(userId: string, planId: string, billingPeriod: BillingPeriod) {
    const existing = await this.prisma.order.findFirst({
      where: {
        userId,
        status: OrderStatus.PENDING,
        planId,
        billingPeriod,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existing) {
      return existing;
    }

    const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) {
      throw new NotFoundException('Plan not found');
    }

    const available = await this.paymentConfig.isPlanAvailableForPurchase(plan.code);
    if (!available) {
      throw new BadRequestException('Plan is not available for purchase');
    }

    const quote = await this.paymentConfig.getPlanPrice(plan.code, billingPeriod);
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

  async startPaymentFlow(userId: string, planId: string, billingPeriod: BillingPeriod) {
    await this.cancelStalePendingPurchases(userId, planId, billingPeriod);
    const order = await this.findOrCreatePendingOrder(userId, planId, billingPeriod);
    return this.prisma.order.update({
      where: { id: order.id },
      data: { awaitingReceipt: false, paymentMethodId: null, paymentMethodName: null, paymentMethodType: null, paymentMethodValue: null, paymentMethodRecipient: null },
    });
  }

  async attachPaymentMethodAndAwaitReceipt(
    orderId: string,
    userId: string,
    method: {
      id?: string;
      name: string;
      type: import('@prisma/client').PaymentMethodType;
      paymentValue: string;
      recipientName: string;
    },
  ) {
    return this.prisma.order.update({
      where: { id: orderId, userId },
      data: {
        paymentMethodId: method.id ?? null,
        paymentMethodName: method.name,
        paymentMethodType: method.type,
        paymentMethodValue: method.paymentValue,
        paymentMethodRecipient: method.recipientName,
        awaitingReceipt: true,
      },
    });
  }

  async getCurrentPendingOrder(userId: string) {
    return this.prisma.order.findFirst({
      where: { userId, status: OrderStatus.PENDING },
      orderBy: { updatedAt: 'desc' },
      include: { plan: true },
    });
  }

  private async cancelStalePendingPurchases(
    userId: string,
    keepPlanId: string,
    keepBillingPeriod: BillingPeriod,
  ) {
    await this.prisma.order.updateMany({
      where: {
        userId,
        status: OrderStatus.PENDING,
        receipts: { none: {} },
        OR: [{ planId: { not: keepPlanId } }, { billingPeriod: { not: keepBillingPeriod } }],
      },
      data: {
        status: OrderStatus.CANCELLED,
        awaitingReceipt: false,
      },
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

  async findAwaitingReceiptOrderById(userId: string, orderId: string) {
    return this.prisma.order.findFirst({
      where: {
        id: orderId,
        userId,
        status: OrderStatus.PENDING,
        awaitingReceipt: true,
      },
    });
  }

  async cancelPendingOrder(userId: string, orderId: string) {
    return this.prisma.order.updateMany({
      where: {
        id: orderId,
        userId,
        status: OrderStatus.PENDING,
      },
      data: {
        status: OrderStatus.CANCELLED,
        awaitingReceipt: false,
      },
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
