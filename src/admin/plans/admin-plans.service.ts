import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditActorType, BillingPeriod, PlanCode } from '@prisma/client';
import { AuditService } from '../../audit/audit.service';
import { parsePlanCode } from '../../payments/plan-code.util';
import { PrismaService } from '../../prisma/prisma.service';
import { CANONICAL_PLAN_CODES } from './canonical-plans';
import { UpdateAdminPlanDto } from './dto/update-admin-plan.dto';
import { SystemPlanBootstrapService } from './system-plan-bootstrap.service';

const POSITIVE_MONEY = /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/;

export type AdminPlanListResponse = {
  plans: Array<{
    id: string;
    code: PlanCode;
    name: string;
    nameTj: string | null;
    isActive: boolean;
    sortOrder: number;
    licenseCount: number;
    orderCount: number;
    maxDevices: number | null;
    priceConfigured: { monthly: boolean; yearly: boolean };
    prices: Array<{
      id: string;
      billingPeriod: BillingPeriod;
      amount: string;
      currency: string;
      isActive: boolean;
    }>;
  }>;
  missingCanonicalCodes: PlanCode[];
};

@Injectable()
export class AdminPlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly planBootstrap: SystemPlanBootstrapService,
  ) {}

  async listPlans(): Promise<AdminPlanListResponse> {
    const plans = await this.prisma.plan.findMany({
      include: {
        prices: { orderBy: { billingPeriod: 'asc' } },
        features: true,
        _count: { select: { licenses: true, orders: true } },
      },
      orderBy: { sortOrder: 'asc' },
    });

    const present = new Set(plans.map((plan) => plan.code));
    const missingCanonicalCodes = CANONICAL_PLAN_CODES.filter((code) => !present.has(code));

    return {
      missingCanonicalCodes,
      plans: plans.map((plan) => {
        const maxDevicesFeature = plan.features.find(
          (feature) => feature.key === 'max_devices' || feature.key === 'device_limit',
        );
        const parsedMax = maxDevicesFeature ? Number.parseInt(maxDevicesFeature.value, 10) : NaN;
        return {
          id: plan.id,
          code: plan.code,
          name: plan.name,
          nameTj: plan.nameTj,
          isActive: plan.isActive,
          sortOrder: plan.sortOrder,
          licenseCount: plan._count.licenses,
          orderCount: plan._count.orders,
          maxDevices: Number.isFinite(parsedMax) && parsedMax >= 1 ? parsedMax : null,
          priceConfigured: {
            monthly: plan.prices.some(
              (price) => price.billingPeriod === BillingPeriod.MONTHLY && price.isActive,
            ),
            yearly: plan.prices.some(
              (price) => price.billingPeriod === BillingPeriod.YEARLY && price.isActive,
            ),
          },
          prices: plan.prices.map((price) => ({
            id: price.id,
            billingPeriod: price.billingPeriod,
            amount: price.amount.toString(),
            currency: price.currency,
            isActive: price.isActive,
          })),
        };
      }),
    };
  }

  async bootstrapMissing(adminId: string): Promise<AdminPlanListResponse> {
    const result = await this.planBootstrap.bootstrapMissingCanonicalPlans();

    await this.auditService.log({
      actorType: AuditActorType.ADMIN,
      actorId: adminId,
      action: 'plan.system.bootstrapped',
      entityType: 'Plan',
      entityId: result.created.join(',') || 'none',
      metadata: {
        created: result.created,
        alreadyPresent: result.alreadyPresent,
        featuresCreated: result.featuresCreated,
      },
    });

    for (const code of result.created) {
      await this.auditService.log({
        actorType: AuditActorType.ADMIN,
        actorId: adminId,
        action: 'plan.system.created',
        entityType: 'Plan',
        entityId: code,
        metadata: { plan: code },
      });
    }

    return this.listPlans();
  }

  async updatePlan(adminId: string, code: string, dto: UpdateAdminPlanDto) {
    const planCode = parsePlanCode(code);
    if (!planCode) {
      throw new BadRequestException('Unknown plan');
    }

    const existing = await this.prisma.plan.findUnique({
      where: { code: planCode },
      include: { prices: true },
    });

    if (!existing) {
      throw new NotFoundException('Plan not found');
    }

    const previousActive = existing.isActive;

    await this.prisma.$transaction(async (tx) => {
      if (dto.isActive !== undefined) {
        await tx.plan.update({
          where: { id: existing.id },
          data: { isActive: dto.isActive },
        });
      }

      if (dto.prices?.length) {
        for (const priceInput of dto.prices) {
          const amount = priceInput.amount?.trim();
          if (!amount) {
            continue;
          }
          if (!POSITIVE_MONEY.test(amount) || Number(amount) <= 0) {
            throw new BadRequestException(`Invalid amount for ${priceInput.billingPeriod}`);
          }

          const priceRow = existing.prices.find(
            (price) => price.billingPeriod === priceInput.billingPeriod,
          );
          if (priceRow) {
            await tx.planPrice.update({
              where: { id: priceRow.id },
              data: { amount },
            });
          } else {
            await tx.planPrice.create({
              data: {
                planId: existing.id,
                billingPeriod: priceInput.billingPeriod,
                amount,
                currency: 'TJS',
                isActive: true,
              },
            });
          }
        }
      }
    });

    if (dto.isActive !== undefined && dto.isActive !== previousActive) {
      await this.auditService.log({
        actorType: AuditActorType.ADMIN,
        actorId: adminId,
        action: 'plan.purchaseAvailability.changed',
        entityType: 'Plan',
        entityId: existing.id,
        metadata: {
          plan: planCode,
          previousValue: previousActive,
          newValue: dto.isActive,
        },
      });
    }

    if (dto.prices?.length) {
      await this.auditService.log({
        actorType: AuditActorType.ADMIN,
        actorId: adminId,
        action: 'plan.prices.updated',
        entityType: 'Plan',
        entityId: existing.id,
        metadata: {
          plan: planCode,
          prices: dto.prices.map((price) => ({
            billingPeriod: price.billingPeriod,
            amount: price.amount,
          })),
        },
      });
    }

    return this.listPlans();
  }
}
