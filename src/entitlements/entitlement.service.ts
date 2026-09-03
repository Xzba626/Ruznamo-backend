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

const PLAN_PRIORITY: Record<PlanCode, number> = {
  [PlanCode.STANDARD]: 1,
  [PlanCode.PRO]: 2,
  [PlanCode.PRO_PLUS]: 3,
};

type LicenseWithPlan = {
  id: string;
  status: LicenseStatus;
  keyPrefix: string;
  startsAt: Date | null;
  expiresAt: Date | null;
  revokedAt: Date | null;
  plan: {
    code: PlanCode;
    name: string;
    features: Array<{ key: string; value: string; valueType: string }>;
  };
};

@Injectable()
export class EntitlementService {
  constructor(private readonly prisma: PrismaService) {}

  async getSnapshot(userId: string, installationId?: string): Promise<EntitlementSnapshot> {
    const [user, currentDevice] = await Promise.all([
      this.prisma.user.findUnique({
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
            include: {
              activations: {
                where: { revokedAt: null },
                include: {
                  license: {
                    include: { plan: { include: { features: true } } },
                  },
                },
              },
            },
          },
        },
      }),
      installationId
        ? this.prisma.deviceInstallation.findFirst({
            where: { userId, installationId },
            select: { id: true, installationId: true, revokedAt: true },
          })
        : Promise.resolve(null),
    ]);

    if (!user) {
      throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'User not found' });
    }

    const currentDeviceRevoked = Boolean(currentDevice?.revokedAt);

    if (user.status === UserStatus.SUSPENDED) {
      return this.buildSnapshot(user, null, null, 'SUSPENDED', 'NONE', false, installationId, 0, currentDeviceRevoked);
    }

    if (user.status === UserStatus.DELETED) {
      return this.buildSnapshot(user, null, null, 'NONE', 'NONE', false, installationId, 0, currentDeviceRevoked);
    }

    const now = new Date();
    const activatedLicenses = this.collectActivatedLicenses(user);
    const ownedLicenses = user.licenses as LicenseWithPlan[];
    const candidateLicenses = this.mergeLicenseCandidates(ownedLicenses, activatedLicenses);
    const activeLicense = this.pickBestActiveLicense(candidateLicenses, now);

    if (activeLicense) {
      const activationCount = await this.countActiveLicenseActivations(activeLicense.id);
      const deviceEntitled =
        !currentDeviceRevoked &&
        Boolean(
          installationId &&
            (await this.currentDeviceHasActiveLicenseActivation(
              userId,
              installationId,
              activeLicense.id,
            )),
        );

      return this.buildSnapshot(
        user,
        activeLicense,
        null,
        'ACTIVE',
        'LICENSE',
        deviceEntitled,
        installationId,
        activationCount,
        currentDeviceRevoked,
      );
    }

    const trial = user.trialGrant;
    const trialActive =
      trial &&
      trial.status === TrialGrantStatus.ACTIVE &&
      trial.expiresAt > now;

    if (trialActive) {
      const trialDeviceEntitled =
        !currentDeviceRevoked &&
        (!installationId || Boolean(currentDevice && !currentDevice.revokedAt));
      return this.buildSnapshot(
        user,
        null,
        trial,
        'TRIAL',
        'TRIAL',
        trialDeviceEntitled,
        installationId,
        0,
        currentDeviceRevoked,
      );
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
      0,
      currentDeviceRevoked,
    );
  }

  async getMaxDevicesForUser(userId: string): Promise<number> {
    const snapshot = await this.getSnapshot(userId);
    return snapshot.devices.max;
  }

  async assertDeviceRegistrationAllowed(userId: string): Promise<void> {
    const [snapshot, user] = await Promise.all([
      this.getSnapshot(userId),
      this.prisma.user.findUnique({
        where: { id: userId },
        include: { devices: { where: { revokedAt: null } } },
      }),
    ]);

    const userDeviceCount = user?.devices.length ?? 0;
    if (userDeviceCount >= snapshot.devices.max) {
      throw new ForbiddenException({
        code: 'DEVICE_LIMIT_REACHED',
        message: 'Active device limit reached for your plan',
      });
    }
  }

  private collectActivatedLicenses(user: {
    devices: Array<{
      installationId: string;
      activations: Array<{ license: LicenseWithPlan }>;
    }>;
  }): LicenseWithPlan[] {
    const map = new Map<string, LicenseWithPlan>();
    for (const device of user.devices) {
      for (const activation of device.activations) {
        if (!map.has(activation.license.id)) {
          map.set(activation.license.id, activation.license);
        }
      }
    }
    return [...map.values()];
  }

  private mergeLicenseCandidates(
    owned: LicenseWithPlan[],
    activated: LicenseWithPlan[],
  ): LicenseWithPlan[] {
    const map = new Map<string, LicenseWithPlan>();
    for (const license of [...owned, ...activated]) {
      map.set(license.id, license);
    }
    return [...map.values()];
  }

  private pickBestActiveLicense(
    licenses: LicenseWithPlan[],
    now: Date,
  ): LicenseWithPlan | null {
    const active = licenses.filter(
      (license) =>
        (license.status === LicenseStatus.ACTIVE || license.status === LicenseStatus.PENDING) &&
        !license.revokedAt &&
        (!license.expiresAt || license.expiresAt > now),
    );

    if (active.length === 0) {
      return null;
    }

    return active.sort((left, right) => {
      const priorityDiff = PLAN_PRIORITY[right.plan.code] - PLAN_PRIORITY[left.plan.code];
      if (priorityDiff !== 0) {
        return priorityDiff;
      }

      const leftExpiry = left.expiresAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const rightExpiry = right.expiresAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return rightExpiry - leftExpiry;
    })[0];
  }

  private async currentDeviceHasActiveLicenseActivation(
    userId: string,
    installationId: string,
    licenseId: string,
  ): Promise<boolean> {
    const activation = await this.prisma.licenseActivation.findFirst({
      where: {
        licenseId,
        revokedAt: null,
        device: {
          userId,
          installationId,
          revokedAt: null,
        },
      },
    });
    return Boolean(activation);
  }

  private async countActiveLicenseActivations(licenseId: string): Promise<number> {
    return this.prisma.licenseActivation.count({
      where: {
        licenseId,
        revokedAt: null,
        device: { revokedAt: null },
      },
    });
  }

  private buildSnapshot(
    user: {
      devices: Array<{ installationId: string; revokedAt: Date | null }>;
      trialGrant: {
        status: TrialGrantStatus;
        expiresAt: Date;
        startedAt: Date;
      } | null;
    },
    license: LicenseWithPlan | null,
    trial: (typeof user.trialGrant) | null,
    effectiveStatus: EffectiveStatus,
    source: AccessSource,
    access: boolean,
    installationId: string | undefined,
    licenseActivationCount: number,
    currentDeviceRevoked: boolean,
  ): EntitlementSnapshot {
    const userDeviceCount = user.devices.filter((device) => !device.revokedAt).length;
    const features = license
      ? this.parsePlanFeatures(license.plan.features)
      : { ...DEFAULT_FEATURES };

    const currentInstallationActive =
      !currentDeviceRevoked &&
      Boolean(
        installationId &&
          user.devices.some(
            (device) => device.installationId === installationId && !device.revokedAt,
          ),
      );

    const devicesActiveCount =
      source === 'LICENSE' && license ? licenseActivationCount : userDeviceCount;

    const installationHasLicenseActivation =
      source === 'LICENSE' && license && installationId
        ? currentInstallationActive &&
          this.deviceHasLicenseActivation(user, installationId, license.id)
        : currentInstallationActive;

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
        activeCount: devicesActiveCount,
        max: features.max_devices,
        currentInstallationActive: installationHasLicenseActivation,
      },
      features,
      evaluatedAt: new Date(),
    };
  }

  private deviceHasLicenseActivation(
    user: {
      devices: Array<{
        installationId: string;
        revokedAt: Date | null;
        activations?: Array<{ license: { id: string } }>;
      }>;
    },
    installationId: string,
    licenseId: string,
  ): boolean {
    return user.devices.some(
      (device) =>
        device.installationId === installationId &&
        !device.revokedAt &&
        device.activations?.some((activation) => activation.license.id === licenseId),
    );
  }

  private parsePlanFeatures(
    planFeatures: Array<{ key: string; value: string; valueType: string }>,
  ): EntitlementFeatures {
    const map = new Map(planFeatures.map((feature) => [feature.key, feature.value]));
    return {
      planning_horizon_days: Number.parseInt(map.get('planning_horizon_days') ?? '28', 10),
      max_devices: Number.parseInt(map.get('max_devices') ?? '1', 10),
      cloud_sync: map.get('cloud_sync') === 'true',
      advanced_analytics: map.get('advanced_analytics') === 'true',
    };
  }
}
