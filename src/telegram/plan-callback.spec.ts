import { PlanCode } from '@prisma/client';
import { parsePlanCallback } from './telegram.messages';

describe('parsePlanCallback', () => {
  it('parses purchasable plan codes', () => {
    expect(parsePlanCallback('plan:STANDARD')).toBe(PlanCode.STANDARD);
    expect(parsePlanCallback('plan:PRO')).toBe(PlanCode.PRO);
  });

  it('rejects non-purchasable plan codes', () => {
    expect(parsePlanCallback('plan:PRO_PLUS')).toBeNull();
    expect(parsePlanCallback('plan:UNKNOWN')).toBeNull();
  });
});
