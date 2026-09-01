import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AuditActorType,
  BillingPeriod,
  LicenseStatus,
  OrderStatus,
  OutboxStatus,
  Prisma,
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
  userId: string;
  licenseId: string;
  licenseKey: string;
  expiresAt: Date;
  alreadyProcessed: boolean;
}

export interface PaymentRejectionResult {
  orderId: string;
  alreadyProcessed: boolean;
}

type ApproveTxResult =
  | { kind: 'duplicate'; licenseId: string; expiresAt: Date | null; userId: string }
  | { kind: 'created'; licenseId: string; expiresAt: Date; userId: string; licenseKey: string };

@Injectable()
export class PaymentApprovalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly licenseKeyService: LicenseKeyService,
    private readonly auditService: AuditService,
  ) {}

  async approve(orderId: string, actor: PaymentActorContext): Promise<PaymentApprovalResult> {
    const rawKey = this.licenseKeyService.generateRawKey();
    const normalizedKey = this.licenseKeyService.normalizeKey(rawKey);
    const keyHash = this.licenseKeyService.hashKey(normalizedKey);
    const keyPrefix = this.licenseKeyService.prefix(normalizedKey);

    let txResult: ApproveTxResult;

    try {
      txResult = await this.prisma.$transaction(async (tx) => {
        const order = await tx.order.findUnique({
          where: { id: orderId },
          include: { license: true, receipts: true, plan: true },
        });

        if (!order) {
          throw new NotFoundException('Order not found');
        }

        if (order.license) {
          return {
            kind: 'duplicate' as const,
            licenseId: order.license.id,
            expiresAt: order.license.expiresAt,
            userId: order.userId,
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

        const now = new Date();
        const expiresAt = this.calculateExpiresAt(now, order.billingPeriod);

        let license;
        try {
          license = await tx.license.create({
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
        } catch (error) {
          if (this.isUniqueViolation(error)) {
            const existing = await tx.license.findUnique({ where: { orderId: order.id } });
            if (existing) {
              return {
                kind: 'duplicate' as const,
                licenseId: existing.id,
                expiresAt: existing.expiresAt,
                userId: order.userId,
              };
            }
          }
          throw error;
        }

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

        return {
          kind: 'created' as const,
          licenseId: license.id,
          expiresAt,
          userId: order.userId,
          licenseKey: normalizedKey,
        };
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        const order = await this.prisma.order.findUnique({
          where: { id: orderId },
          include: { license: true },
        });
        if (order?.license) {
          txResult = {
            kind: 'duplicate',
            licenseId: order.license.id,
            expiresAt: order.license.expiresAt,
            userId: order.userId,
          };
        } else {
          throw error;
        }
      } else {
        throw error;
      }
    }

    if (txResult.kind === 'duplicate') {
      await this.auditService.log({
        actorType: actor.actorType,
        actorId: actor.actorId,
        action: 'payment.approve.duplicate',
        entityType: 'Order',
        entityId: orderId,
      });
      const storedKey = await this.findStoredLicenseKey(txResult.licenseId, txResult.userId);
      return {
        orderId,
        userId: txResult.userId,
        licenseId: txResult.licenseId,
        licenseKey: storedKey ?? '[already-delivered]',
        expiresAt: txResult.expiresAt ?? new Date(),
        alreadyProcessed: true,
      };
    }

    await this.auditService.log({
      actorType: actor.actorType,
      actorId: actor.actorId,
      action: 'payment.approved',
      entityType: 'Order',
      entityId: orderId,
      metadata: {
        licenseId: txResult.licenseId,
        telegramUserId: actor.telegramUserId,
        keyPrefix,
      },
    });

    return {
      orderId,
      userId: txResult.userId,
      licenseId: txResult.licenseId,
      licenseKey: txResult.licenseKey,
      expiresAt: txResult.expiresAt,
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

  async getStoredLicenseKeyForUser(
    userId: string,
  ): Promise<{
    key: string;
    expiresAt: Date | null;
    billingPeriod: import('@prisma/client').BillingPeriod | null;
    planName: string | null;
  } | null> {
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
      include: { plan: true, order: true },
      orderBy: { expiresAt: 'desc' },
    });

    if (!payload.licenseKey || !license) {
      return null;
    }

    return {
      key: payload.licenseKey,
      expiresAt: license.expiresAt,
      billingPeriod: license.order?.billingPeriod ?? null,
      planName: license.plan.name,
    };
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
    const days = billingPeriod === BillingPeriod.YEARLY ? 365 : 30;
    expires.setDate(expires.getDate() + days);
    return expires;
  }

  private isUniqueViolation(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }
}
