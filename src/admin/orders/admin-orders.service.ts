import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditActorType, OrderStatus, Prisma } from '@prisma/client';
import { PaymentApprovalService } from '../../payments/payment-approval.service';
import { TelegramLicenseDeliveryService } from '../../payments/telegram-license-delivery.service';
import { PrismaService } from '../../prisma/prisma.service';
import { readMaxDevicesFromFeatures } from '../common/plan-features.util';
import { maskInstallationId, serializeOrderUser } from '../common/serialize-user';
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
          license: { select: { id: true, keyPrefix: true, status: true } },
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
        paymentMethodName: order.paymentMethodName,
        user: serializeOrderUser(order.user),
        plan: order.plan,
        hasReceipt: order.receipts.length > 0,
        license: order.license,
      })),
      meta: paginateMeta(total, page, limit),
    };
  }

  async getById(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        plan: {
          select: {
            code: true,
            name: true,
            features: { select: { key: true, value: true } },
          },
        },
        user: {
          select: {
            id: true,
            displayName: true,
            email: true,
            telegramAccount: {
              select: {
                telegramId: true,
                username: true,
                firstName: true,
                lastName: true,
                language: true,
                linkedAt: true,
              },
            },
          },
        },
        receipts: { orderBy: { submittedAt: 'desc' } },
        license: {
          include: {
            activations: {
              include: {
                device: {
                  include: {
                    user: { select: { id: true, displayName: true, email: true } },
                  },
                },
              },
              orderBy: { createdAt: 'desc' },
            },
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const deviceLimit = readMaxDevicesFromFeatures(order.plan.features);

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
      rejectionReasonCode: order.rejectionReasonCode,
      paymentMethodName: order.paymentMethodName,
      paymentMethodType: order.paymentMethodType,
      paymentMethodValue: order.paymentMethodValue,
      paymentMethodRecipient: order.paymentMethodRecipient,
      user: serializeOrderUser(order.user),
      plan: {
        code: order.plan.code,
        name: order.plan.name,
        deviceLimit: Number.isFinite(deviceLimit) ? deviceLimit : null,
      },
      receipts: order.receipts.map((r) => ({
        id: r.id,
        status: r.status,
        submittedAt: r.submittedAt,
      })),
      license: order.license
        ? {
            id: order.license.id,
            keyPrefix: order.license.keyPrefix,
            status: order.license.status,
            startsAt: order.license.startsAt,
            expiresAt: order.license.expiresAt,
            activatedAt: order.license.activatedAt,
            activationCount: order.license.activations.length,
            deviceLimit,
            activations: order.license.activations.map((activation) => ({
              id: activation.id,
              activatedAt: activation.createdAt,
              device: {
                id: activation.device.id,
                deviceName: activation.device.deviceName,
                installationId: maskInstallationId(activation.device.installationId),
                platform: activation.device.platform,
                appVersion: activation.device.appVersion,
                lastSeenAt: activation.device.lastSeenAt,
                revokedAt: activation.device.revokedAt,
              },
              mobileUser: activation.device.user
                ? {
                    id: activation.device.user.id,
                    displayName: activation.device.user.displayName,
                    email: activation.device.user.email,
                  }
                : null,
            })),
          }
        : null,
    };
  }

  async approve(orderId: string, adminId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { billingPeriod: true, plan: { select: { name: true } } },
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
        planName: order?.plan.name,
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
