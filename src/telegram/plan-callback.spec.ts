import { PlanCode } from '@prisma/client';
import { parsePlanCallback } from './telegram.messages';

describe('parsePlanCallback', () => {
  it('parses known PlanCode enum values', () => {
    expect(parsePlanCallback('plan:STANDARD')).toBe(PlanCode.STANDARD);
    expect(parsePlanCallback('plan:PRO')).toBe(PlanCode.PRO);
    expect(parsePlanCallback('plan:PRO_PLUS')).toBe(PlanCode.PRO_PLUS);
  });

  it('rejects unknown callback values', () => {
    expect(parsePlanCallback('plan:ENTERPRISE')).toBeNull();
    expect(parsePlanCallback('plan:UNKNOWN')).toBeNull();
  });
});
