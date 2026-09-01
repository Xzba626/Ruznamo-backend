import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditActorType, OrderStatus, Prisma } from '@prisma/client';
import { PaymentApprovalService } from '../../payments/payment-approval.service';
import { TelegramLicenseDeliveryService } from '../../payments/telegram-license-delivery.service';
import { PrismaService } from '../../prisma/prisma.service';
import { paginateMeta, PaginationQueryDto } from '../common/dto/pagination.dto';

@Injectable()
export class AdminOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentApprovalService: PaymentApprovalService,
    private readonly telegramLicenseDelivery: TelegramLicenseDeliveryService,
  ) {}

  async list(query: PaginationQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.OrderWhereInput = query.search
      ? {
          OR: [
            { user: { displayName: { contains: query.search, mode: 'insensitive' } } },
            { user: { email: { contains: query.search, mode: 'insensitive' } } },
            { user: { telegramAccount: { username: { contains: query.search, mode: 'insensitive' } } } },
            { id: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {};

    const [items, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          plan: { select: { code: true, name: true } },
          user: {
            select: {
              id: true,
              displayName: true,
              email: true,
              telegramAccount: {
                select: { telegramId: true, username: true, firstName: true },
              },
            },
          },
          receipts: { select: { id: true, status: true }, take: 1, orderBy: { submittedAt: 'desc' } },
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      items: items.map((order) => ({
        id: order.id,
        status: order.status,
        billingPeriod: order.billingPeriod,
        amount: order.amount.toString(),
        currency: order.currency,
        createdAt: order.createdAt,
        user: order.user,
        plan: order.plan,
        hasReceipt: order.receipts.length > 0,
      })),
      meta: paginateMeta(total, page, limit),
    };
  }

  async getById(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        plan: { select: { code: true, name: true } },
        user: {
          select: {
            id: true,
            displayName: true,
            email: true,
            telegramAccount: {
              select: { telegramId: true, username: true, firstName: true },
            },
          },
        },
        receipts: { orderBy: { submittedAt: 'desc' } },
        license: { select: { id: true, keyPrefix: true, status: true } },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return {
      id: order.id,
      status: order.status,
      billingPeriod: order.billingPeriod,
      amount: order.amount.toString(),
      currency: order.currency,
      createdAt: order.createdAt,
      approvedAt: order.approvedAt,
      rejectedAt: order.rejectedAt,
      rejectionReason: order.rejectionReason,
      user: order.user,
      plan: order.plan,
      receipts: order.receipts.map((r) => ({
        id: r.id,
        status: r.status,
        submittedAt: r.submittedAt,
      })),
      license: order.license,
    };
  }

  async approve(orderId: string, adminId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { billingPeriod: true },
    });

    const result = await this.paymentApprovalService.approve(orderId, {
      actorType: AuditActorType.ADMIN,
      actorId: adminId,
    });

    if (!result.alreadyProcessed) {
      await this.telegramLicenseDelivery.deliverLicenseKey({
        userId: result.userId,
        licenseId: result.licenseId,
        licenseKey: result.licenseKey,
        expiresAt: result.expiresAt,
        billingPeriod: order?.billingPeriod,
      });
    }

    return {
      orderId: result.orderId,
      licenseId: result.licenseId,
      status: OrderStatus.COMPLETED,
      alreadyProcessed: result.alreadyProcessed,
    };
  }

  async reject(orderId: string, adminId: string, reason?: string) {
    const result = await this.paymentApprovalService.reject(orderId, {
      actorType: AuditActorType.ADMIN,
      actorId: adminId,
    }, reason);

    return {
      orderId: result.orderId,
      status: OrderStatus.REJECTED,
      alreadyProcessed: result.alreadyProcessed,
    };
  }
}
