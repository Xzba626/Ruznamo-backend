import { ForbiddenException } from '@nestjs/common';
import {
  LicenseStatus,
  PlanCode,
  TrialGrantStatus,
  UserStatus,
} from '@prisma/client';
import { EntitlementService } from './entitlement.service';

describe('EntitlementService', () => {
  const prisma = {
    user: { findUnique: jest.fn() },
    licenseActivation: { count: jest.fn(), findFirst: jest.fn() },
    deviceInstallation: { findFirst: jest.fn() },
  };

  const service = new EntitlementService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.licenseActivation.count.mockResolvedValue(0);
    prisma.licenseActivation.findFirst.mockResolvedValue(null);
    prisma.deviceInstallation.findFirst.mockResolvedValue(null);
  });

  it('returns trial access for active trial', async () => {
    prisma.deviceInstallation.findFirst.mockResolvedValue({
      id: 'dev_1',
      installationId: 'inst-1',
      revokedAt: null,
    });
    prisma.user.findUnique.mockResolvedValue({
      status: UserStatus.ACTIVE,
      trialGrant: {
        status: TrialGrantStatus.ACTIVE,
        expiresAt: new Date(Date.now() + 3600000),
        startedAt: new Date(),
      },
      licenses: [],
      devices: [{ installationId: 'inst-1', revokedAt: null, activations: [] }],
    });

    const snapshot = await service.getSnapshot('usr_1', 'inst-1');

    expect(snapshot.access).toBe(true);
    expect(snapshot.source).toBe('TRIAL');
    expect(snapshot.plan?.code).toBe(PlanCode.STANDARD);
    expect(snapshot.devices.max).toBe(1);
  });

  it('returns no access for expired trial', async () => {
    prisma.user.findUnique.mockResolvedValue({
      status: UserStatus.ACTIVE,
      trialGrant: {
        status: TrialGrantStatus.ACTIVE,
        expiresAt: new Date(Date.now() - 3600000),
        startedAt: new Date(Date.now() - 7200000),
      },
      licenses: [],
      devices: [{ installationId: 'inst-1', revokedAt: null, activations: [] }],
    });

    const snapshot = await service.getSnapshot('usr_1');

    expect(snapshot.access).toBe(false);
    expect(snapshot.source).toBe('NONE');
    expect(snapshot.effectiveStatus).toBe('EXPIRED');
  });

  it('returns license access when the mobile user has a device activation', async () => {
    prisma.licenseActivation.count.mockResolvedValue(1);
    prisma.licenseActivation.findFirst.mockResolvedValue({ id: 'act_1' });
    prisma.deviceInstallation.findFirst.mockResolvedValue({
      id: 'dev_1',
      installationId: 'inst-1',
      revokedAt: null,
    });
    prisma.user.findUnique.mockResolvedValue({
      status: UserStatus.ACTIVE,
      trialGrant: null,
      licenses: [],
      devices: [
        {
          installationId: 'inst-1',
          revokedAt: null,
          activations: [
            {
              license: {
                id: 'lic_1',
                status: LicenseStatus.ACTIVE,
                keyPrefix: 'RZ-ABCD',
                startsAt: new Date(Date.now() - 3600000),
                expiresAt: new Date(Date.now() + 86400000),
                revokedAt: null,
                plan: {
                  code: PlanCode.PRO,
                  name: 'Pro',
                  features: [
                    { key: 'planning_horizon_days', value: '90', valueType: 'INT' },
                    { key: 'max_devices', value: '2', valueType: 'INT' },
                    { key: 'cloud_sync', value: 'true', valueType: 'BOOL' },
                    { key: 'advanced_analytics', value: 'true', valueType: 'BOOL' },
                  ],
                },
              },
            },
          ],
        },
      ],
    });

    const snapshot = await service.getSnapshot('usr_mobile', 'inst-1');

    expect(snapshot.access).toBe(true);
    expect(snapshot.source).toBe('LICENSE');
    expect(snapshot.devices.max).toBe(2);
    expect(snapshot.devices.activeCount).toBe(1);
    expect(snapshot.devices.currentInstallationActive).toBe(true);
  });

  it('denies device entitlement when license is owned but current device has no activation', async () => {
    prisma.licenseActivation.count.mockResolvedValue(0);
    prisma.deviceInstallation.findFirst.mockResolvedValue({
      id: 'dev_1',
      installationId: 'inst-1',
      revokedAt: null,
    });
    prisma.user.findUnique.mockResolvedValue({
      status: UserStatus.ACTIVE,
      trialGrant: null,
      licenses: [
        {
          id: 'lic_1',
          status: LicenseStatus.ACTIVE,
          keyPrefix: 'RZ-ABCD',
          startsAt: new Date(Date.now() - 3600000),
          expiresAt: new Date(Date.now() + 86400000),
          revokedAt: null,
          plan: {
            code: PlanCode.PRO,
            name: 'Pro',
            features: [
              { key: 'planning_horizon_days', value: '90', valueType: 'INT' },
              { key: 'max_devices', value: '2', valueType: 'INT' },
              { key: 'cloud_sync', value: 'true', valueType: 'BOOL' },
              { key: 'advanced_analytics', value: 'true', valueType: 'BOOL' },
            ],
          },
        },
      ],
      devices: [{ installationId: 'inst-1', revokedAt: null, activations: [] }],
    });

    const snapshot = await service.getSnapshot('usr_1', 'inst-1');

    expect(snapshot.access).toBe(false);
    expect(snapshot.source).toBe('LICENSE');
    expect(snapshot.license?.id).toBe('lic_1');
    expect(snapshot.devices.currentInstallationActive).toBe(false);
  });

  it('denies entitlement on revoked installation even when license is active', async () => {
    prisma.licenseActivation.count.mockResolvedValue(1);
    prisma.deviceInstallation.findFirst.mockResolvedValue({
      id: 'dev_1',
      installationId: 'inst-revoked',
      revokedAt: new Date(),
    });
    prisma.user.findUnique.mockResolvedValue({
      status: UserStatus.ACTIVE,
      trialGrant: null,
      licenses: [
        {
          id: 'lic_1',
          status: LicenseStatus.ACTIVE,
          keyPrefix: 'RZ-ABCD',
          startsAt: new Date(Date.now() - 3600000),
          expiresAt: new Date(Date.now() + 86400000),
          revokedAt: null,
          plan: {
            code: PlanCode.PRO,
            name: 'Pro',
            features: [
              { key: 'planning_horizon_days', value: '90', valueType: 'INT' },
              { key: 'max_devices', value: '2', valueType: 'INT' },
              { key: 'cloud_sync', value: 'true', valueType: 'BOOL' },
              { key: 'advanced_analytics', value: 'true', valueType: 'BOOL' },
            ],
          },
        },
      ],
      devices: [],
    });

    const snapshot = await service.getSnapshot('usr_1', 'inst-revoked');

    expect(snapshot.access).toBe(false);
    expect(snapshot.license?.id).toBe('lic_1');
    expect(snapshot.devices.currentInstallationActive).toBe(false);
  });

  it('returns license metadata without device entitlement when license is owned but no installation context', async () => {
    prisma.licenseActivation.count.mockResolvedValue(0);
    prisma.user.findUnique.mockResolvedValue({
      status: UserStatus.ACTIVE,
      trialGrant: null,
      licenses: [
        {
          id: 'lic_1',
          status: LicenseStatus.ACTIVE,
          keyPrefix: 'RZ-ABCD',
          startsAt: new Date(Date.now() - 3600000),
          expiresAt: new Date(Date.now() + 86400000),
          revokedAt: null,
          plan: {
            code: PlanCode.PRO,
            name: 'Pro',
            features: [
              { key: 'planning_horizon_days', value: '90', valueType: 'INT' },
              { key: 'max_devices', value: '2', valueType: 'INT' },
              { key: 'cloud_sync', value: 'true', valueType: 'BOOL' },
              { key: 'advanced_analytics', value: 'true', valueType: 'BOOL' },
            ],
          },
        },
      ],
      devices: [{ installationId: 'inst-1', revokedAt: null, activations: [] }],
    });

    const snapshot = await service.getSnapshot('usr_1');

    expect(snapshot.access).toBe(false);
    expect(snapshot.source).toBe('LICENSE');
    expect(snapshot.devices.max).toBe(2);
  });

  it('throws when device limit reached for trial users', async () => {
    const trialUser = {
      status: UserStatus.ACTIVE,
      trialGrant: {
        status: TrialGrantStatus.ACTIVE,
        expiresAt: new Date(Date.now() + 3600000),
        startedAt: new Date(),
      },
      licenses: [],
      devices: [{ installationId: 'inst-1', revokedAt: null, activations: [] }],
    };

    prisma.user.findUnique.mockImplementation(async (args: { include?: Record<string, unknown> }) => {
      if (args.include && !('trialGrant' in args.include)) {
        return { devices: [{ id: 'dev_1' }] };
      }
      return trialUser;
    });

    const snapshot = await service.getSnapshot('usr_1');
    expect(snapshot.devices.max).toBe(1);

    await expect(service.assertDeviceRegistrationAllowed('usr_1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
