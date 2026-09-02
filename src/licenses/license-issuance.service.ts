import { Injectable } from '@nestjs/common';
import {
  BillingPeriod,
  LicenseIssueSource,
  LicenseStatus,
  Prisma,
} from '@prisma/client';
import { LicenseKeyService } from '../security/license-key.service';
import { PrismaService } from '../prisma/prisma.service';

export interface IssueLicenseInput {
  planId: string;
  userId?: string | null;
  orderId?: string | null;
  issueSource: LicenseIssueSource;
  billingPeriod: BillingPeriod;
  issuedByAdminId?: string | null;
  adminNote?: string | null;
  customerLabel?: string | null;
  eventReason: string;
  eventMetadata?: Record<string, unknown>;
  /** When true, license is immediately ACTIVE with startsAt/expiresAt (payment/manual delivery). */
  activateNow?: boolean;
}

export interface IssuedLicenseResult {
  licenseId: string;
  licenseKey: string;
  keyPrefix: string;
  expiresAt: Date;
  alreadyExisted: boolean;
}

@Injectable()
export class LicenseIssuanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly licenseKeyService: LicenseKeyService,
  ) {}

  calculateExpiresAt(start: Date, billingPeriod: BillingPeriod): Date {
    const expires = new Date(start);
    const days = billingPeriod === BillingPeriod.YEARLY ? 365 : 30;
    expires.setDate(expires.getDate() + days);
    return expires;
  }

  async issueLicense(input: IssueLicenseInput): Promise<IssuedLicenseResult> {
    if (input.orderId) {
      const existing = await this.prisma.license.findUnique({
        where: { orderId: input.orderId },
      });
      if (existing) {
        const storedKey = await this.findStoredKey(existing.id);
        return {
          licenseId: existing.id,
          licenseKey: storedKey ?? '[already-delivered]',
          keyPrefix: existing.keyPrefix,
          expiresAt: existing.expiresAt ?? new Date(),
          alreadyExisted: true,
        };
      }
    }

    const rawKey = this.licenseKeyService.generateRawKey();
    const normalizedKey = this.licenseKeyService.normalizeKey(rawKey);
    const keyHash = this.licenseKeyService.hashKey(normalizedKey);
    const keyPrefix = this.licenseKeyService.prefix(normalizedKey);
    const now = new Date();
    const expiresAt = this.calculateExpiresAt(now, input.billingPeriod);
    const activateNow = input.activateNow !== false;
    let racedDuplicate = false;

    const license = await this.prisma.$transaction(async (tx) => {
      let created;
      try {
        created = await tx.license.create({
          data: {
            planId: input.planId,
            userId: input.userId ?? null,
            orderId: input.orderId ?? null,
            keyHash,
            keyPrefix,
            issueSource: input.issueSource,
            issuedByAdminId: input.issuedByAdminId ?? null,
            adminNote: input.adminNote ?? null,
            customerLabel: input.customerLabel ?? null,
            status: activateNow ? LicenseStatus.ACTIVE : LicenseStatus.PENDING,
            startsAt: activateNow ? now : null,
            expiresAt,
            activatedAt: activateNow ? now : null,
          },
        });
      } catch (error) {
        if (this.isUniqueViolation(error) && input.orderId) {
          const dup = await tx.license.findUnique({ where: { orderId: input.orderId } });
          if (dup) {
            racedDuplicate = true;
            return dup;
          }
        }
        throw error;
      }

      await tx.licenseEvent.create({
        data: {
          licenseId: created.id,
          fromStatus: LicenseStatus.PENDING,
          toStatus: activateNow ? LicenseStatus.ACTIVE : LicenseStatus.PENDING,
          reason: input.eventReason,
          metadata: (input.eventMetadata ?? {}) as Prisma.InputJsonValue,
        },
      });

      return created;
    });

    if (racedDuplicate && input.orderId) {
      const storedKey = await this.findStoredKey(license.id);
      return {
        licenseId: license.id,
        licenseKey: storedKey ?? '[already-delivered]',
        keyPrefix: license.keyPrefix,
        expiresAt: license.expiresAt ?? expiresAt,
        alreadyExisted: true,
      };
    }

    const alreadyExisted =
      input.orderId != null &&
      (await this.prisma.license.count({ where: { orderId: input.orderId, id: { not: license.id } } })) > 0;

    if (alreadyExisted) {
      const existing = await this.prisma.license.findUniqueOrThrow({ where: { orderId: input.orderId! } });
      const storedKey = await this.findStoredKey(existing.id);
      return {
        licenseId: existing.id,
        licenseKey: storedKey ?? '[already-delivered]',
        keyPrefix: existing.keyPrefix,
        expiresAt: existing.expiresAt ?? expiresAt,
        alreadyExisted: true,
      };
    }

    return {
      licenseId: license.id,
      licenseKey: normalizedKey,
      keyPrefix,
      expiresAt,
      alreadyExisted: false,
    };
  }

  private async findStoredKey(licenseId: string): Promise<string | null> {
    const outbox = await this.prisma.notificationOutbox.findFirst({
      where: {
        type: 'telegram_license_key',
        payload: { path: ['licenseId'], equals: licenseId },
      },
      orderBy: { createdAt: 'desc' },
    });
    const payload = outbox?.payload as { licenseKey?: string } | undefined;
    return payload?.licenseKey ?? null;
  }

  private isUniqueViolation(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }
}
