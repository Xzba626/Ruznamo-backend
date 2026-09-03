import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditActorType, BillingPeriod, LicenseActivationRevokeReason, LicenseIssueSource, LicenseStatus, PlanCode, Prisma } from '@prisma/client';
import { AuditService } from '../../audit/audit.service';
import { readMaxDevicesFromFeatures } from '../common/plan-features.util';
import { LicenseIssuanceService } from '../../licenses/license-issuance.service';
import { PrismaService } from '../../prisma/prisma.service';
import { paginateMeta, PaginationQueryDto } from '../common/dto/pagination.dto';
import { CreateManualLicenseDto } from './dto/create-manual-license.dto';

@Injectable()
export class AdminLicensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly licenseIssuance: LicenseIssuanceService,
  ) {}

  async list(query: PaginationQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.LicenseWhereInput = query.search
      ? {
          OR: [
            { keyPrefix: { contains: query.search, mode: 'insensitive' } },
            { user: { email: { contains: query.search, mode: 'insensitive' } } },
            { user: { displayName: { contains: query.search, mode: 'insensitive' } } },
          ],
        }
      : {};

    const [items, total] = await Promise.all([
      this.prisma.license.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          plan: { select: { code: true, name: true } },
          user: { select: { id: true, displayName: true, email: true } },
          _count: { select: { activations: true } },
        },
      }),
      this.prisma.license.count({ where }),
    ]);

    return {
      items: items.map((license) => ({
        id: license.id,
        keyPrefix: license.keyPrefix,
        status: license.status,
        plan: license.plan,
        user: license.user,
        activationCount: license._count.activations,
        startsAt: license.startsAt,
        expiresAt: license.expiresAt,
        activatedAt: license.activatedAt,
        revokedAt: license.revokedAt,
        createdAt: license.createdAt,
        issueSource: (license as { issueSource?: LicenseIssueSource | null }).issueSource,
      })),
      meta: paginateMeta(total, page, limit),
    };
  }

  async getById(id: string) {
    const license = (await this.prisma.license.findUnique({
      where: { id },
      include: {
        plan: { include: { features: true } },
        user: {
          select: {
            id: true,
            displayName: true,
            email: true,
            status: true,
            telegramAccount: true,
          },
        },
        purchaserTelegramAccount: true,
        holderTelegramAccount: true,
        holderHistory: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: {
            fromTelegramAccount: { select: { id: true, username: true, firstName: true } },
            toTelegramAccount: { select: { id: true, username: true, firstName: true } },
          },
        },
        order: {
          include: {
            plan: true,
            paymentMethod: true,
            receipts: { take: 1, orderBy: { id: 'desc' } },
          },
        },
        issuedByAdmin: { select: { id: true, email: true, displayName: true } },
        activations: { include: { device: { include: { user: { select: { id: true, displayName: true, category: true } } } } } },
        events: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    })) as any;

    if (!license) {
      throw new NotFoundException('License not found');
    }

    const deviceLimit = readMaxDevicesFromFeatures(license.plan.features);
    const activeDeviceCount = license.activations.filter(
      (a: { revokedAt: Date | null; device: { revokedAt: Date | null } }) =>
        !a.revokedAt && !a.device.revokedAt,
    ).length;

    return {
      id: license.id,
      keyPrefix: license.keyPrefix,
      status: license.status,
      issueSource: license.issueSource ?? LicenseIssueSource.UNKNOWN_LEGACY,
      customerLabel: license.customerLabel,
      adminNote: license.adminNote,
      plan: license.plan,
      user: license.user,
      purchaserTelegramAccount: license.purchaserTelegramAccount,
      holderTelegramAccount: license.holderTelegramAccount,
      holderLinkedAt: license.holderLinkedAt,
      holderHistory: license.holderHistory,
      order: license.order,
      issuedByAdmin: license.issuedByAdmin,
      deviceLimit,
      activeDeviceCount,
      startsAt: license.startsAt,
      expiresAt: license.expiresAt,
      activatedAt: license.activatedAt,
      revokedAt: license.revokedAt,
      createdAt: license.createdAt,
      activations: license.activations.map((a: {
        id: string;
        deviceId: string;
        createdAt: Date;
        device: {
          installationId: string;
          deviceName: string | null;
          deviceManufacturer: string | null;
          deviceModel: string | null;
          androidOsVersion: string | null;
          appVersion: string | null;
          registrationIp: string | null;
          lastSeenIp: string | null;
          lastSeenAt: Date;
          revokedAt: Date | null;
          user: { id: string; displayName: string | null; category: string | null };
        };
      }) => ({
        id: a.id,
        deviceId: a.deviceId,
        installationId: a.device.installationId,
        deviceName: a.device.deviceName,
        deviceManufacturer: a.device.deviceManufacturer,
        deviceModel: a.device.deviceModel,
        androidOsVersion: a.device.androidOsVersion,
        appVersion: a.device.appVersion,
        registrationIp: a.device.registrationIp,
        lastSeenIp: a.device.lastSeenIp,
        lastSeenAt: a.device.lastSeenAt,
        revokedAt: a.device.revokedAt,
        mobileUser: a.device.user,
        createdAt: a.createdAt,
      })),
      events: license.events,
    };
  }

  async createManual(adminId: string, dto: CreateManualLicenseDto) {
    const plan = await this.prisma.plan.findUnique({ where: { code: dto.planCode } });
    if (!plan) {
      throw new NotFoundException('Plan not found');
    }

    let userId: string | null = null;
    if (dto.linkTelegramUserId?.trim()) {
      const tg = await this.prisma.telegramAccount.findUnique({
        where: { telegramId: BigInt(dto.linkTelegramUserId.trim()) },
      });
      if (!tg) {
        throw new BadRequestException('Telegram account not found');
      }
      userId = tg.userId;
    }

    const issued = await this.licenseIssuance.issueLicense({
      planId: plan.id,
      userId,
      issueSource: LicenseIssueSource.ADMIN_MANUAL,
      billingPeriod: dto.billingPeriod,
      issuedByAdminId: adminId,
      adminNote: dto.adminNote ?? null,
      customerLabel: dto.customerLabel ?? null,
      eventReason: 'admin_manual_issue',
      eventMetadata: { adminId },
      activateNow: true,
    });

    await this.auditService.log({
      actorType: AuditActorType.ADMIN,
      actorId: adminId,
      action: 'admin.license.manual_created',
      entityType: 'License',
      entityId: issued.licenseId,
      metadata: { planCode: dto.planCode, billingPeriod: dto.billingPeriod, keyPrefix: issued.keyPrefix },
    });

    return {
      id: issued.licenseId,
      licenseKey: issued.licenseKey,
      keyPrefix: issued.keyPrefix,
      expiresAt: issued.expiresAt,
      issueSource: LicenseIssueSource.ADMIN_MANUAL,
      planCode: dto.planCode,
      billingPeriod: dto.billingPeriod,
    };
  }

  async revoke(id: string, adminId: string, reason?: string) {
    const license = await this.prisma.license.findUnique({ where: { id } });
    if (!license) {
      throw new NotFoundException('License not found');
    }

    if (license.status === LicenseStatus.REVOKED) {
      return { id, status: license.status };
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.license.update({
        where: { id },
        data: { status: LicenseStatus.REVOKED, revokedAt: new Date() },
      });
      await tx.licenseEvent.create({
        data: {
          licenseId: id,
          fromStatus: license.status,
          toStatus: LicenseStatus.REVOKED,
          reason: reason ?? 'admin_revoke',
        },
      });
      return result;
    });

    await this.auditService.log({
      actorType: AuditActorType.ADMIN,
      actorId: adminId,
      action: 'admin.license.revoke',
      entityType: 'License',
      entityId: id,
    });

    return { id: updated.id, status: updated.status };
  }

  async revokeDeviceActivation(adminId: string, licenseId: string, deviceId: string) {
    const license = await this.prisma.license.findUnique({ where: { id: licenseId } });
    if (!license) {
      throw new NotFoundException('License not found');
    }

    const activation = await this.prisma.licenseActivation.findFirst({
      where: { licenseId, deviceId, revokedAt: null },
      include: { device: true },
    });
    if (!activation || activation.device.revokedAt) {
      throw new BadRequestException('Device activation not found or already revoked');
    }

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.licenseActivation.update({
        where: { id: activation.id },
        data: {
          revokedAt: now,
          revokeReason: LicenseActivationRevokeReason.ADMIN_DISCONNECT,
        },
      });
      await tx.licenseEvent.create({
        data: {
          licenseId,
          fromStatus: license.status,
          toStatus: license.status,
          reason: 'admin_device_revoked',
          metadata: { deviceId, adminId },
        },
      });
    });

    await this.auditService.log({
      actorType: AuditActorType.ADMIN,
      actorId: adminId,
      action: 'admin.license.device_revoked',
      entityType: 'LicenseActivation',
      entityId: activation.id,
      metadata: { licenseId, deviceId },
    });

    return { ok: true };
  }

  async unlinkHolder(adminId: string, licenseId: string) {
    const license = await this.prisma.license.findUnique({ where: { id: licenseId } });
    if (!license) {
      throw new NotFoundException('License not found');
    }
    if (!license.holderTelegramAccountId) {
      return { ok: true, alreadyUnlinked: true };
    }

    const fromId = license.holderTelegramAccountId;
    await this.prisma.$transaction(async (tx) => {
      await tx.license.update({
        where: { id: licenseId },
        data: { holderTelegramAccountId: null, holderLinkedAt: null },
      });
      await tx.licenseHolderHistory.create({
        data: {
          licenseId,
          fromTelegramAccountId: fromId,
          toTelegramAccountId: null,
          reason: 'admin_holder_unlinked',
          actorType: AuditActorType.ADMIN,
          actorId: adminId,
        },
      });
    });

    await this.auditService.log({
      actorType: AuditActorType.ADMIN,
      actorId: adminId,
      action: 'admin.license.holder_unlinked',
      entityType: 'License',
      entityId: licenseId,
    });

    return { ok: true };
  }

  async assignHolder(adminId: string, licenseId: string, telegramAccountId: string) {
    const [license, account] = await Promise.all([
      this.prisma.license.findUnique({ where: { id: licenseId } }),
      this.prisma.telegramAccount.findUnique({ where: { id: telegramAccountId } }),
    ]);
    if (!license) {
      throw new NotFoundException('License not found');
    }
    if (!account) {
      throw new BadRequestException('Telegram account not found');
    }

    const fromId = license.holderTelegramAccountId;
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.license.update({
        where: { id: licenseId },
        data: { holderTelegramAccountId: telegramAccountId, holderLinkedAt: now },
      });
      await tx.licenseHolderHistory.create({
        data: {
          licenseId,
          fromTelegramAccountId: fromId,
          toTelegramAccountId: telegramAccountId,
          reason: 'admin_holder_assigned',
          actorType: AuditActorType.ADMIN,
          actorId: adminId,
        },
      });
    });

    await this.auditService.log({
      actorType: AuditActorType.ADMIN,
      actorId: adminId,
      action: 'admin.license.holder_assigned',
      entityType: 'License',
      entityId: licenseId,
      metadata: { telegramAccountId },
    });

    return { ok: true, holderTelegramAccountId: telegramAccountId };
  }
}
