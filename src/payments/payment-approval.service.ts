import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AuditActorType,
  BillingPeriod,
  LicenseStatus,
  OrderStatus,
  OutboxStatus,
  ReceiptStatus,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { LicenseKeyService } from '../security/license-key.service';
import { PrismaService } from '../prisma/prisma.service';

export interface PaymentActorContext {
  actorType: AuditActorType;
  actorId: string;
  telegramUserId?: string;
}

export interface PaymentApprovalResult {
  orderId: string;
  licenseId: string;
  licenseKey: string;
  expiresAt: Date;
  alreadyProcessed: boolean;
}

export interface PaymentRejectionResult {
  orderId: string;
  alreadyProcessed: boolean;
}

@Injectable()
export class PaymentApprovalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly licenseKeyService: LicenseKeyService,
    private readonly auditService: AuditService,
  ) {}

  async approve(orderId: string, actor: PaymentActorContext): Promise<PaymentApprovalResult> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { license: true, receipts: true, plan: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.license) {
      await this.auditService.log({
        actorType: actor.actorType,
        actorId: actor.actorId,
        action: 'payment.approve.duplicate',
        entityType: 'Order',
        entityId: order.id,
      });
      const storedKey = await this.findStoredLicenseKey(order.license.id, order.userId);
      return {
        orderId: order.id,
        licenseId: order.license.id,
        licenseKey: storedKey ?? '[already-delivered]',
        expiresAt: order.license.expiresAt ?? new Date(),
        alreadyProcessed: true,
      };
    }

    if (order.status === OrderStatus.COMPLETED || order.status === OrderStatus.APPROVED) {
      throw new BadRequestException('Order already completed without license record');
    }

    if (order.status !== OrderStatus.UNDER_REVIEW && order.status !== OrderStatus.RECEIPT_SUBMITTED) {
      throw new BadRequestException('Order is not eligible for approval');
    }

    if (order.receipts.length === 0) {
      throw new BadRequestException('Receipt is required before approval');
    }

    const rawKey = this.licenseKeyService.generateRawKey();
    const normalizedKey = this.licenseKeyService.normalizeKey(rawKey);
    const keyHash = this.licenseKeyService.hashKey(normalizedKey);
    const keyPrefix = this.licenseKeyService.prefix(normalizedKey);
    const now = new Date();
    const expiresAt = this.calculateExpiresAt(now, order.billingPeriod);

    const result = await this.prisma.$transaction(async (tx) => {
      const license = await tx.license.create({
        data: {
          planId: order.planId,
          userId: order.userId,
          orderId: order.id,
          keyHash,
          keyPrefix,
          status: LicenseStatus.ACTIVE,
          startsAt: now,
          expiresAt,
          activatedAt: now,
        },
      });

      await tx.licenseEvent.create({
        data: {
          licenseId: license.id,
          fromStatus: LicenseStatus.PENDING,
          toStatus: LicenseStatus.ACTIVE,
          reason: 'telegram_payment_approved',
          metadata: { orderId: order.id, actorId: actor.actorId },
        },
      });

      await tx.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.COMPLETED,
          approvedAt: now,
          paidAt: now,
        },
      });

      await tx.receipt.updateMany({
        where: { orderId: order.id, status: ReceiptStatus.PENDING },
        data: { status: ReceiptStatus.APPROVED, reviewedAt: now },
      });

      await tx.notificationOutbox.create({
        data: {
          type: 'telegram_license_key',
          payload: {
            userId: order.userId,
            licenseId: license.id,
            orderId: order.id,
            licenseKey: normalizedKey,
          },
          status: OutboxStatus.COMPLETED,
          processedAt: now,
        },
      });

      return license;
    });

    await this.auditService.log({
      actorType: actor.actorType,
      actorId: actor.actorId,
      action: 'payment.approved',
      entityType: 'Order',
      entityId: order.id,
      metadata: {
        licenseId: result.id,
        telegramUserId: actor.telegramUserId,
        keyPrefix,
      },
    });

    return {
      orderId: order.id,
      licenseId: result.id,
      licenseKey: normalizedKey,
      expiresAt,
      alreadyProcessed: false,
    };
  }

  async reject(
    orderId: string,
    actor: PaymentActorContext,
    reason?: string,
  ): Promise<PaymentRejectionResult> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.status === OrderStatus.REJECTED) {
      return { orderId: order.id, alreadyProcessed: true };
    }

    if (order.status === OrderStatus.COMPLETED || order.status === OrderStatus.APPROVED) {
      throw new BadRequestException('Completed orders cannot be rejected');
    }

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.REJECTED,
          rejectedAt: now,
          rejectionReason: reason ?? 'admin_rejected',
          awaitingReceipt: false,
        },
      });

      await tx.receipt.updateMany({
        where: { orderId: order.id },
        data: {
          status: ReceiptStatus.REJECTED,
          reviewedAt: now,
          rejectionReason: reason ?? 'admin_rejected',
        },
      });
    });

    await this.auditService.log({
      actorType: actor.actorType,
      actorId: actor.actorId,
      action: 'payment.rejected',
      entityType: 'Order',
      entityId: order.id,
      metadata: { telegramUserId: actor.telegramUserId },
    });

    return { orderId: order.id, alreadyProcessed: false };
  }

  async getStoredLicenseKeyForUser(userId: string): Promise<{ key: string; expiresAt: Date | null } | null> {
    const outbox = await this.prisma.notificationOutbox.findFirst({
      where: {
        type: 'telegram_license_key',
        status: OutboxStatus.COMPLETED,
        payload: {
          path: ['userId'],
          equals: userId,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!outbox) {
      return null;
    }

    const payload = outbox.payload as { licenseKey?: string };
    const license = await this.prisma.license.findFirst({
      where: { userId, status: LicenseStatus.ACTIVE },
      orderBy: { expiresAt: 'desc' },
    });

    if (!payload.licenseKey || !license) {
      return null;
    }

    return { key: payload.licenseKey, expiresAt: license.expiresAt };
  }

  private async findStoredLicenseKey(licenseId: string, userId: string): Promise<string | null> {
    const outbox = await this.prisma.notificationOutbox.findFirst({
      where: {
        type: 'telegram_license_key',
        status: OutboxStatus.COMPLETED,
        payload: {
          path: ['licenseId'],
          equals: licenseId,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (outbox) {
      const payload = outbox.payload as { licenseKey?: string; userId?: string };
      if (payload.userId === userId && payload.licenseKey) {
        return payload.licenseKey;
      }
    }

    return null;
  }

  private calculateExpiresAt(start: Date, billingPeriod: BillingPeriod): Date {
    const expires = new Date(start);
    if (billingPeriod === BillingPeriod.YEARLY) {
      expires.setFullYear(expires.getFullYear() + 1);
    } else {
      expires.setMonth(expires.getMonth() + 1);
    }
    return expires;
  }
}
