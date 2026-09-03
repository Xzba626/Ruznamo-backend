import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AuditActorType,
  BillingPeriod,
  LicenseIssueSource,
  LicenseStatus,
  OrderStatus,
  OutboxStatus,
  Prisma,
  ReceiptStatus,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { LicenseIssuanceService } from '../licenses/license-issuance.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  PaymentRejectionReasonCode,
  parsePaymentRejectionReasonCode,
  rejectionReasonLabel,
} from './rejection-reason';

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
  reasonCode?: string | null;
  reasonText?: string | null;
}

export type PaymentRejectReasonInput =
  | string
  | {
      code?: string | null;
      text?: string | null;
    };

@Injectable()
export class PaymentApprovalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly licenseIssuance: LicenseIssuanceService,
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
      const storedKey = await this.findStoredLicenseKey(order.license.id, order.userId);
      await this.auditService.log({
        actorType: actor.actorType,
        actorId: actor.actorId,
        action: 'payment.approve.duplicate',
        entityType: 'Order',
        entityId: orderId,
      });
      return {
        orderId,
        userId: order.userId,
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

    const now = new Date();

    const purchaserTelegram = await this.prisma.telegramAccount.findUnique({
      where: { userId: order.userId },
      select: { id: true },
    });

    const issued = await this.licenseIssuance.issueLicense({
      planId: order.planId,
      userId: order.userId,
      orderId: order.id,
      issueSource: LicenseIssueSource.TELEGRAM_PAYMENT,
      billingPeriod: order.billingPeriod,
      purchaserTelegramAccountId: purchaserTelegram?.id ?? null,
      holderTelegramAccountId: purchaserTelegram?.id ?? null,
      eventReason: 'telegram_payment_approved',
      eventMetadata: { orderId: order.id, actorId: actor.actorId },
      activateNow: true,
    });

    if (!issued.alreadyExisted) {
      await this.prisma.$transaction(async (tx) => {
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
              licenseId: issued.licenseId,
              orderId: order.id,
              licenseKey: issued.licenseKey,
            },
            status: OutboxStatus.COMPLETED,
            processedAt: now,
          },
        });
      });
    }

    await this.auditService.log({
      actorType: actor.actorType,
      actorId: actor.actorId,
      action: issued.alreadyExisted ? 'payment.approve.duplicate' : 'payment.approved',
      entityType: 'Order',
      entityId: orderId,
      metadata: {
        licenseId: issued.licenseId,
        telegramUserId: actor.telegramUserId,
        keyPrefix: issued.keyPrefix,
      },
    });

    return {
      orderId,
      userId: order.userId,
      licenseId: issued.licenseId,
      licenseKey: issued.licenseKey,
      expiresAt: issued.expiresAt,
      alreadyProcessed: issued.alreadyExisted,
    };
  }

  async reject(
    orderId: string,
    actor: PaymentActorContext,
    reason?: PaymentRejectReasonInput,
  ): Promise<PaymentRejectionResult> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.status === OrderStatus.REJECTED) {
      return {
        orderId: order.id,
        alreadyProcessed: true,
        reasonCode: order.rejectionReasonCode,
        reasonText: order.rejectionReason,
      };
    }

    if (order.status === OrderStatus.COMPLETED || order.status === OrderStatus.APPROVED) {
      throw new BadRequestException('Completed orders cannot be rejected');
    }

    const normalized = this.normalizeRejectReason(reason);
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.REJECTED,
          rejectedAt: now,
          rejectionReason: normalized.text,
          rejectionReasonCode: normalized.code,
          awaitingReceipt: false,
        },
      });

      await tx.receipt.updateMany({
        where: { orderId: order.id },
        data: {
          status: ReceiptStatus.REJECTED,
          reviewedAt: now,
          rejectionReason: normalized.text,
        },
      });
    });

    await this.auditService.log({
      actorType: actor.actorType,
      actorId: actor.actorId,
      action: 'payment.rejected',
      entityType: 'Order',
      entityId: order.id,
      metadata: {
        telegramUserId: actor.telegramUserId,
        reasonCode: normalized.code,
      },
    });

    return {
      orderId: order.id,
      alreadyProcessed: false,
      reasonCode: normalized.code,
      reasonText: normalized.text,
    };
  }

  private normalizeRejectReason(reason?: PaymentRejectReasonInput): {
    code: string;
    text: string;
  } {
    if (typeof reason === 'string') {
      const asCode = parsePaymentRejectionReasonCode(reason);
      if (asCode && asCode !== PaymentRejectionReasonCode.OTHER) {
        return { code: asCode, text: rejectionReasonLabel(asCode, 'RU') };
      }
      const text = reason.trim() || 'admin_rejected';
      return { code: PaymentRejectionReasonCode.OTHER, text };
    }

    const code =
      parsePaymentRejectionReasonCode(reason?.code) ?? PaymentRejectionReasonCode.OTHER;
    const custom = reason?.text?.trim();
    if (code === PaymentRejectionReasonCode.OTHER) {
      return {
        code,
        text: custom || rejectionReasonLabel(PaymentRejectionReasonCode.OTHER, 'RU'),
      };
    }
    return {
      code,
      text: custom || rejectionReasonLabel(code, 'RU'),
    };
  }

  async getStoredLicenseKeyForUser(
    userId: string,
  ): Promise<{
    key: string;
    expiresAt: Date | null;
    billingPeriod: BillingPeriod | null;
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
}
