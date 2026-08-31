import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  LicenseStatus,
  PlanCode,
  TrialGrantStatus,
  UserStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type EffectiveStatus = 'ACTIVE' | 'TRIAL' | 'EXPIRED' | 'SUSPENDED' | 'NONE';
export type AccessSource = 'TRIAL' | 'LICENSE' | 'NONE';

export interface EntitlementFeatures {
  planning_horizon_days: number;
  max_devices: number;
  cloud_sync: boolean;
  advanced_analytics: boolean;
}

export interface EntitlementSnapshot {
  access: boolean;
  source: AccessSource;
  effectiveStatus: EffectiveStatus;
  plan: { code: PlanCode; name: string } | null;
  trial: {
    status: TrialGrantStatus;
    expiresAt: Date;
    startedAt: Date;
  } | null;
  license: {
    id: string;
    status: LicenseStatus;
    keyPrefix: string;
    startsAt: Date | null;
    expiresAt: Date | null;
  } | null;
  devices: {
    activeCount: number;
    max: number;
    currentInstallationActive: boolean;
  };
  features: EntitlementFeatures;
  evaluatedAt: Date;
}

const DEFAULT_FEATURES: EntitlementFeatures = {
  planning_horizon_days: 28,
  max_devices: 1,
  cloud_sync: false,
  advanced_analytics: false,
};

@Injectable()
export class EntitlementService {
  constructor(private readonly prisma: PrismaService) {}

  async getSnapshot(userId: string, installationId?: string): Promise<EntitlementSnapshot> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        trialGrant: true,
        licenses: {
          where: {
            status: { in: [LicenseStatus.ACTIVE, LicenseStatus.PENDING] },
          },
          orderBy: { expiresAt: 'desc' },
          include: { plan: { include: { features: true } } },
        },
        devices: {
          where: { revokedAt: null },
        },
      },
    });

    if (!user) {
      throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'User not found' });
    }

    if (user.status === UserStatus.SUSPENDED) {
      return this.buildSnapshot(user, null, null, 'SUSPENDED', 'NONE', false, installationId);
    }

    if (user.status === UserStatus.DELETED) {
      return this.buildSnapshot(user, null, null, 'NONE', 'NONE', false, installationId);
    }

    const now = new Date();
    const activeLicense = user.licenses.find(
      (license) =>
        license.status === LicenseStatus.ACTIVE &&
        (!license.expiresAt || license.expiresAt > now),
    );

    if (activeLicense) {
      return this.buildSnapshot(
        user,
        activeLicense,
        null,
        'ACTIVE',
        'LICENSE',
        true,
        installationId,
      );
    }

    const trial = user.trialGrant;
    const trialActive =
      trial &&
      trial.status === TrialGrantStatus.ACTIVE &&
      trial.expiresAt > now;

    if (trialActive) {
      return this.buildSnapshot(user, null, trial, 'TRIAL', 'TRIAL', true, installationId);
    }

    const trialExpired = trial && trial.expiresAt <= now;
    return this.buildSnapshot(
      user,
      null,
      trial,
      trialExpired ? 'EXPIRED' : 'NONE',
      'NONE',
      false,
      installationId,
    );
  }

  async getMaxDevicesForUser(userId: string): Promise<number> {
    const snapshot = await this.getSnapshot(userId);
    return snapshot.devices.max;
  }

  async assertDeviceRegistrationAllowed(userId: string): Promise<void> {
    const snapshot = await this.getSnapshot(userId);
    if (snapshot.devices.activeCount >= snapshot.devices.max) {
      throw new ForbiddenException({
        code: 'DEVICE_LIMIT_REACHED',
        message: 'Active device limit reached for your plan',
      });
    }
  }

  private buildSnapshot(
    user: {
      devices: Array<{ installationId: string; revokedAt: Date | null }>;
      licenses: Array<{
        id: string;
        status: LicenseStatus;
        keyPrefix: string;
        startsAt: Date | null;
        expiresAt: Date | null;
        plan: {
          code: PlanCode;
          name: string;
          features: Array<{ key: string; value: string; valueType: string }>;
        };
      }>;
      trialGrant: {
        status: TrialGrantStatus;
        expiresAt: Date;
        startedAt: Date;
      } | null;
    },
    license: (typeof user.licenses)[number] | null,
    trial: (typeof user.trialGrant) | null,
    effectiveStatus: EffectiveStatus,
    source: AccessSource,
    access: boolean,
    installationId?: string,
  ): EntitlementSnapshot {
    const activeCount = user.devices.filter((d) => !d.revokedAt).length;
    const features = license
      ? this.parsePlanFeatures(license.plan.features)
      : { ...DEFAULT_FEATURES };

    const currentInstallationActive = installationId
      ? user.devices.some((d) => d.installationId === installationId && !d.revokedAt)
      : false;

    return {
      access,
      source,
      effectiveStatus,
      plan: license
        ? { code: license.plan.code, name: license.plan.name }
        : access && source === 'TRIAL'
          ? { code: PlanCode.STANDARD, name: 'Standard' }
          : null,
      trial: trial
        ? {
            status:
              trial.expiresAt <= new Date() && trial.status === TrialGrantStatus.ACTIVE
                ? TrialGrantStatus.EXPIRED
                : trial.status,
            expiresAt: trial.expiresAt,
            startedAt: trial.startedAt,
          }
        : null,
      license: license
        ? {
            id: license.id,
            status: license.status,
            keyPrefix: license.keyPrefix,
            startsAt: license.startsAt,
            expiresAt: license.expiresAt,
          }
        : null,
      devices: {
        activeCount,
        max: features.max_devices,
        currentInstallationActive,
      },
      features,
      evaluatedAt: new Date(),
    };
  }

  private parsePlanFeatures(
    planFeatures: Array<{ key: string; value: string; valueType: string }>,
  ): EntitlementFeatures {
    const map = new Map(planFeatures.map((f) => [f.key, f.value]));
    return {
      planning_horizon_days: Number.parseInt(map.get('planning_horizon_days') ?? '28', 10),
      max_devices: Number.parseInt(map.get('max_devices') ?? '1', 10),
      cloud_sync: map.get('cloud_sync') === 'true',
      advanced_analytics: map.get('advanced_analytics') === 'true',
    };
  }
}
