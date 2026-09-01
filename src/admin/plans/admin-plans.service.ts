import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditActorType, PlanCode } from '@prisma/client';
import { AuditService } from '../../audit/audit.service';
import { parsePlanCode } from '../../payments/plan-code.util';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateAdminPlanDto } from './dto/update-admin-plan.dto';

@Injectable()
export class AdminPlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async listPlans() {
    const plans = await this.prisma.plan.findMany({
      include: {
        prices: { orderBy: { billingPeriod: 'asc' } },
        _count: { select: { licenses: true, orders: true } },
      },
      orderBy: { sortOrder: 'asc' },
    });

    return plans.map((plan) => ({
      id: plan.id,
      code: plan.code,
      name: plan.name,
      nameTj: plan.nameTj,
      isActive: plan.isActive,
      sortOrder: plan.sortOrder,
      licenseCount: plan._count.licenses,
      orderCount: plan._count.orders,
      prices: plan.prices.map((price) => ({
        id: price.id,
        billingPeriod: price.billingPeriod,
        amount: price.amount.toString(),
        currency: price.currency,
        isActive: price.isActive,
      })),
    }));
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
          const priceRow = existing.prices.find(
            (price) => price.billingPeriod === priceInput.billingPeriod,
          );
          if (!priceRow) {
            throw new BadRequestException(
              `Price for ${priceInput.billingPeriod} is not configured`,
            );
          }

          await tx.planPrice.update({
            where: { id: priceRow.id },
            data: { amount: priceInput.amount },
          });
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
