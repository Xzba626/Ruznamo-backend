import { PlanCode } from '@prisma/client';

/** Structural validation only — commercial availability comes from Plan.isActive + PlanPrice in DB. */
const PLAN_CODE_VALUES = new Set<string>(Object.values(PlanCode));

export function parsePlanCode(value: string): PlanCode | null {
  const normalized = value.trim().toUpperCase();
  return PLAN_CODE_VALUES.has(normalized) ? (normalized as PlanCode) : null;
}

/**
 * PlanCode is a Prisma enum (STANDARD | PRO | PRO_PLUS).
 * Arbitrary new tariff names cannot be added without a schema/code change.
 */
export function isKnownPlanCode(value: string): value is PlanCode {
  return parsePlanCode(value) !== null;
}
