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
  };

  const service = new EntitlementService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns trial access for active trial', async () => {
    prisma.user.findUnique.mockResolvedValue({
      status: UserStatus.ACTIVE,
      trialGrant: {
        status: TrialGrantStatus.ACTIVE,
        expiresAt: new Date(Date.now() + 3600000),
        startedAt: new Date(),
      },
      licenses: [],
      devices: [{ installationId: 'inst-1', revokedAt: null }],
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
      devices: [{ installationId: 'inst-1', revokedAt: null }],
    });

    const snapshot = await service.getSnapshot('usr_1');

    expect(snapshot.access).toBe(false);
    expect(snapshot.source).toBe('NONE');
    expect(snapshot.effectiveStatus).toBe('EXPIRED');
  });

  it('returns license access when active license exists', async () => {
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
      devices: [{ installationId: 'inst-1', revokedAt: null }],
    });

    const snapshot = await service.getSnapshot('usr_1');

    expect(snapshot.access).toBe(true);
    expect(snapshot.source).toBe('LICENSE');
    expect(snapshot.devices.max).toBe(2);
  });

  it('throws when device limit reached', async () => {
    prisma.user.findUnique.mockResolvedValue({
      status: UserStatus.ACTIVE,
      trialGrant: {
        status: TrialGrantStatus.ACTIVE,
        expiresAt: new Date(Date.now() + 3600000),
        startedAt: new Date(),
      },
      licenses: [],
      devices: [{ installationId: 'inst-1', revokedAt: null }],
    });

    await expect(service.assertDeviceRegistrationAllowed('usr_1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
