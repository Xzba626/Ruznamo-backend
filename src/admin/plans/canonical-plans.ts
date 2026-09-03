import { FeatureValueType, PlanCode } from '@prisma/client';

export const CANONICAL_PLAN_CODES: PlanCode[] = [
  PlanCode.STANDARD,
  PlanCode.PRO,
  PlanCode.PRO_PLUS,
];

export const CANONICAL_PLAN_LABEL: Record<PlanCode, string> = {
  [PlanCode.STANDARD]: 'Standard',
  [PlanCode.PRO]: 'Pro',
  [PlanCode.PRO_PLUS]: 'Pro Plus',
};

export type CanonicalFeatureSpec = {
  key: string;
  value: string;
  valueType: FeatureValueType;
};

export type CanonicalPlanSpec = {
  code: PlanCode;
  name: string;
  nameTj: string;
  sortOrder: number;
  /** Public Telegram sale. Pro / Pro Plus stay off unless an admin later enables them. */
  isActive: boolean;
  features: CanonicalFeatureSpec[];
};

/** Structural catalog only. No commercial PlanPrice amounts. */
export const CANONICAL_PLAN_SPECS: CanonicalPlanSpec[] = [
  {
    code: PlanCode.STANDARD,
    name: 'Standard',
    nameTj: 'Standard',
    sortOrder: 1,
    isActive: true,
    features: [
      { key: 'planning_horizon_days', value: '28', valueType: FeatureValueType.INT },
      { key: 'max_devices', value: '2', valueType: FeatureValueType.INT },
      { key: 'cloud_sync', value: 'false', valueType: FeatureValueType.BOOL },
      { key: 'advanced_analytics', value: 'false', valueType: FeatureValueType.BOOL },
    ],
  },
  {
    code: PlanCode.PRO,
    name: 'Pro',
    nameTj: 'Pro',
    sortOrder: 2,
    isActive: false,
    features: [
      { key: 'planning_horizon_days', value: '90', valueType: FeatureValueType.INT },
      { key: 'max_devices', value: '2', valueType: FeatureValueType.INT },
      { key: 'cloud_sync', value: 'true', valueType: FeatureValueType.BOOL },
      { key: 'advanced_analytics', value: 'true', valueType: FeatureValueType.BOOL },
    ],
  },
  {
    code: PlanCode.PRO_PLUS,
    name: 'Pro Plus',
    nameTj: 'Pro Plus',
    sortOrder: 3,
    isActive: false,
    features: [{ key: 'max_devices', value: '2', valueType: FeatureValueType.INT }],
  },
];
