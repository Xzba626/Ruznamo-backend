import { Injectable } from '@nestjs/common';
import { PlanCode } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CANONICAL_PLAN_CODES, CANONICAL_PLAN_SPECS } from './canonical-plans';

export type PlanBootstrapResult = {
  created: PlanCode[];
  alreadyPresent: PlanCode[];
  featuresCreated: Array<{ planCode: PlanCode; key: string }>;
};

@Injectable()
export class SystemPlanBootstrapService {
  constructor(private readonly prisma: PrismaService) {}

  async listMissingCanonicalCodes(): Promise<PlanCode[]> {
    const existing = await this.prisma.plan.findMany({
      where: { code: { in: CANONICAL_PLAN_CODES } },
      select: { code: true },
    });
    const present = new Set(existing.map((row) => row.code));
    return CANONICAL_PLAN_CODES.filter((code) => !present.has(code));
  }

  /**
   * Idempotent: creates only missing canonical plans and missing features.
   * Never writes PlanPrice. Never overwrites existing plan/sale/price/feature values.
   */
  async bootstrapMissingCanonicalPlans(): Promise<PlanBootstrapResult> {
    const created: PlanCode[] = [];
    const alreadyPresent: PlanCode[] = [];
    const featuresCreated: Array<{ planCode: PlanCode; key: string }> = [];

    await this.prisma.$transaction(async (tx) => {
      for (const spec of CANONICAL_PLAN_SPECS) {
        const before = await tx.plan.findUnique({
          where: { code: spec.code },
          select: { id: true },
        });

        const plan = await tx.plan.upsert({
          where: { code: spec.code },
          update: {},
          create: {
            code: spec.code,
            name: spec.name,
            nameTj: spec.nameTj,
            isActive: spec.isActive,
            sortOrder: spec.sortOrder,
          },
        });

        if (before) {
          alreadyPresent.push(spec.code);
        } else {
          created.push(spec.code);
        }

        for (const feature of spec.features) {
          const existingFeature = await tx.planFeature.findUnique({
            where: { planId_key: { planId: plan.id, key: feature.key } },
            select: { id: true },
          });
          if (existingFeature) {
            continue;
          }
          await tx.planFeature.create({
            data: {
              planId: plan.id,
              key: feature.key,
              value: feature.value,
              valueType: feature.valueType,
            },
          });
          featuresCreated.push({ planCode: spec.code, key: feature.key });
        }
      }
    });

    return { created, alreadyPresent, featuresCreated };
  }
}
