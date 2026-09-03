import { PlanCode } from '@prisma/client';
import { SystemPlanBootstrapService } from './system-plan-bootstrap.service';

describe('SystemPlanBootstrapService', () => {
  const plans = new Map<PlanCode, { id: string; code: PlanCode; isActive: boolean }>();
  const features = new Map<string, { planId: string; key: string; value: string }>();

  const tx = {
    plan: {
      findUnique: jest.fn(async ({ where }: { where: { code: PlanCode } }) => plans.get(where.code) ?? null),
      upsert: jest.fn(
        async ({
          where,
          create,
        }: {
          where: { code: PlanCode };
          create: { code: PlanCode; isActive: boolean };
        }) => {
          const existing = plans.get(where.code);
          if (existing) {
            return existing;
          }
          const row = { id: `id_${create.code}`, code: create.code, isActive: create.isActive };
          plans.set(create.code, row);
          return row;
        },
      ),
      findMany: jest.fn(async () => [...plans.values()]),
    },
    planFeature: {
      findUnique: jest.fn(
        async ({ where }: { where: { planId_key: { planId: string; key: string } } }) => {
          return features.get(`${where.planId_key.planId}:${where.planId_key.key}`) ?? null;
        },
      ),
      create: jest.fn(async ({ data }: { data: { planId: string; key: string; value: string } }) => {
        features.set(`${data.planId}:${data.key}`, data);
        return data;
      }),
    },
  };

  const prisma = {
    plan: {
      findMany: jest.fn(async ({ where }: { where: { code: { in: PlanCode[] } } }) =>
        [...plans.values()].filter((row) => where.code.in.includes(row.code)),
      ),
    },
    $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<void>) => callback(tx)),
  };

  const service = new SystemPlanBootstrapService(prisma as never);

  beforeEach(() => {
    plans.clear();
    features.clear();
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(async (callback: (client: typeof tx) => Promise<void>) =>
      callback(tx),
    );
  });

  it('creates exactly Standard, Pro, Pro Plus from empty DB without PlanPrice', async () => {
    const result = await service.bootstrapMissingCanonicalPlans();
    expect(result.created).toEqual([PlanCode.STANDARD, PlanCode.PRO, PlanCode.PRO_PLUS]);
    expect(plans.get(PlanCode.STANDARD)?.isActive).toBe(true);
    expect(plans.get(PlanCode.PRO)?.isActive).toBe(false);
    expect(plans.get(PlanCode.PRO_PLUS)?.isActive).toBe(false);
    expect(tx.planFeature.create).toHaveBeenCalled();
    expect(
      [...features.values()].some((row) => row.key === 'max_devices' && row.value === '2'),
    ).toBe(true);
  });

  it('is idempotent: second call creates no duplicate plans', async () => {
    await service.bootstrapMissingCanonicalPlans();
    const result = await service.bootstrapMissingCanonicalPlans();
    expect(result.created).toEqual([]);
    expect(result.alreadyPresent).toEqual([PlanCode.STANDARD, PlanCode.PRO, PlanCode.PRO_PLUS]);
    expect(plans.size).toBe(3);
  });

  it('creates only the missing canonical plan', async () => {
    plans.set(PlanCode.STANDARD, { id: 'std', code: PlanCode.STANDARD, isActive: true });
    plans.set(PlanCode.PRO, { id: 'pro', code: PlanCode.PRO, isActive: false });
    const result = await service.bootstrapMissingCanonicalPlans();
    expect(result.created).toEqual([PlanCode.PRO_PLUS]);
    expect(result.alreadyPresent).toEqual([PlanCode.STANDARD, PlanCode.PRO]);
  });

  it('does not overwrite existing Standard sale flag or feature values', async () => {
    plans.set(PlanCode.STANDARD, { id: 'std', code: PlanCode.STANDARD, isActive: false });
    features.set('std:max_devices', { planId: 'std', key: 'max_devices', value: '9' });
    await service.bootstrapMissingCanonicalPlans();
    expect(plans.get(PlanCode.STANDARD)?.isActive).toBe(false);
    expect(features.get('std:max_devices')?.value).toBe('9');
  });

  it('keeps Pro and Pro Plus public sale off when created', async () => {
    await service.bootstrapMissingCanonicalPlans();
    expect(plans.get(PlanCode.PRO)?.isActive).toBe(false);
    expect(plans.get(PlanCode.PRO_PLUS)?.isActive).toBe(false);
  });
});
