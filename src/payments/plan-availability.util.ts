import { PlanCode } from '@prisma/client';

/** Plans that can be sold through Telegram / public purchase flows. */
export const PURCHASABLE_PLAN_CODES: readonly PlanCode[] = [PlanCode.STANDARD, PlanCode.PRO];

export function isPurchasablePlanCode(code: PlanCode): boolean {
  return PURCHASABLE_PLAN_CODES.includes(code);
}
