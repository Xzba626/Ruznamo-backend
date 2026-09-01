import { parsePlanCode } from './plan-code.util';

describe('plan-code.util', () => {
  it('accepts all Prisma PlanCode enum members structurally', () => {
    expect(parsePlanCode('STANDARD')).toBe('STANDARD');
    expect(parsePlanCode('pro')).toBe('PRO');
    expect(parsePlanCode('PRO_PLUS')).toBe('PRO_PLUS');
  });

  it('rejects values outside PlanCode enum', () => {
    expect(parsePlanCode('ENTERPRISE')).toBeNull();
  });
});
