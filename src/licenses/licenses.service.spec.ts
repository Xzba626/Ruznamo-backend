import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { LicenseStatus, PlanCode, Prisma } from '@prisma/client';
import { LicensesService } from './licenses.service';

describe('LicensesService', () => {
  const prisma = {
    $transaction: jest.fn(),
    licenseActivation: { findMany: jest.fn() },
  };
  const licenseKeyService = {
    normalizeKey: jest.fn((key: string) => key.trim().toLowerCase()),
    hashKey: jest.fn(() => 'hash-abc'),
  };
  const entitlementService = {
    getSnapshot: jest.fn(),
  };
  const auditService = {
    log: jest.fn(),
  };

  const service = new LicensesService(
    prisma as never,
    licenseKeyService as never,
    entitlementService as never,
    auditService as never,
  );

  const telegramUserId = 'user_telegram';
  const mobileUserId = 'user_mobile';
  const deviceId = 'device_mobile';
  const mobileJwt = {
    sub: mobileUserId,
    deviceId,
    installationId: 'inst-1',
    type: 'access' as const,
    aud: 'ruznamo-mobile',
  };
  const licenseId = 'license_1';
  const licenseKey = 'abcd1234efgh5678ijkl9012mnop3456qrst7890uvwx1234yzab5678cdef';

  const baseLicense = {
    id: licenseId,
    userId: telegramUserId,
    status: LicenseStatus.ACTIVE,
    revokedAt: null,
    expiresAt: new Date(Date.now() + 86400000),
    startsAt: new Date(),
    activatedAt: new Date(),
    keyPrefix: 'abcd1234',
    plan: {
      code: PlanCode.PRO,
      name: 'Pro',
      features: [{ key: 'max_devices', value: '2' }],
    },
  };

  const mobileDevice = {
    id: deviceId,
    userId: mobileUserId,
    revokedAt: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    entitlementService.getSnapshot.mockResolvedValue({
      access: true,
      source: 'LICENSE',
      effectiveStatus: 'ACTIVE',
      plan: { code: PlanCode.PRO, name: 'Pro' },
      trial: null,
      license: { id: licenseId, status: LicenseStatus.ACTIVE, keyPrefix: 'abcd1234' },
      devices: { activeCount: 1, max: 2, currentInstallationActive: true },
      features: {},
      evaluatedAt: new Date(),
    });
  });

  function mockTransaction(handlers: {
    license?: Record<string, unknown> | null;
    device?: typeof mobileDevice | null;
    existingActivation?: { id: string } | null;
    activeActivationCount?: number;
    createError?: Prisma.PrismaClientKnownRequestError;
    racedActivation?: { id: string } | null;
  }) {
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      license: {
        findUnique: jest.fn().mockResolvedValue(
          'license' in handlers ? handlers.license : baseLicense,
        ),
        update: jest.fn().mockResolvedValue(baseLicense),
      },
      deviceInstallation: {
        findFirst: jest.fn().mockResolvedValue(
          'device' in handlers ? handlers.device : mobileDevice,
        ),
      },
      licenseActivation: {
        findUnique: jest.fn().mockImplementation(async () => {
          if (handlers.racedActivation !== undefined) {
            return handlers.racedActivation;
          }
          return handlers.existingActivation ?? null;
        }),
        count: jest.fn().mockResolvedValue(handlers.activeActivationCount ?? 0),
        create: handlers.createError
          ? jest.fn().mockRejectedValue(handlers.createError)
          : jest.fn().mockResolvedValue({ id: 'activation_1' }),
      },
      licenseEvent: {
        create: jest.fn().mockResolvedValue({ id: 'event_1' }),
      },
    };

    prisma.$transaction.mockImplementation(async (callback: (inner: typeof tx) => Promise<unknown>) =>
      callback(tx),
    );

    return tx;
  }

  it('activates a Telegram-purchased license for a different mobile user', async () => {
    const tx = mockTransaction({});

    const result = await service.activate(mobileJwt, licenseKey, {});

    expect(tx.$executeRaw).toHaveBeenCalled();
    expect(tx.licenseActivation.create).toHaveBeenCalledWith({
      data: { licenseId, deviceId },
    });
    expect(tx.license.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: licenseId },
        data: expect.not.objectContaining({ userId: mobileUserId }),
      }),
    );
    expect(result.license.plan.code).toBe(PlanCode.PRO);
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'license.activated' }),
    );
  });

  it('returns idempotent success when the same device is already activated', async () => {
    mockTransaction({ existingActivation: { id: 'activation_existing' } });

    const result = await service.activate(mobileJwt, licenseKey, {});

    expect(result.license.id).toBe(licenseId);
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'license.activation.idempotent' }),
    );
  });

  it('handles P2002 race by returning idempotent success for the same device', async () => {
    const p2002 = new Prisma.PrismaClientKnownRequestError('Unique constraint', {
      code: 'P2002',
      clientVersion: '6.0.0',
    });
    mockTransaction({ createError: p2002, racedActivation: { id: 'activation_race' } });

    await service.activate(mobileJwt, licenseKey, {});

    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'license.activation.idempotent' }),
    );
  });

  it('rejects activation when the license device limit is reached', async () => {
    mockTransaction({ activeActivationCount: 2 });

    await expect(service.activate(mobileJwt, licenseKey, {})).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rejects STANDARD license activation when one device slot is already used', async () => {
    mockTransaction({
      license: {
        ...baseLicense,
        plan: {
          code: PlanCode.STANDARD,
          name: 'Standard',
          features: [{ key: 'max_devices', value: '1' }],
        },
      },
      activeActivationCount: 1,
    });

    await expect(service.activate(mobileJwt, licenseKey, {})).rejects.toMatchObject({
      response: { code: 'DEVICE_REPLACEMENT_REQUIRED' },
    });
  });

  it('rejects invalid license keys', async () => {
    mockTransaction({ license: null });

    await expect(service.activate(mobileJwt, 'invalid-key', {})).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rejects expired licenses', async () => {
    mockTransaction({
      license: {
        ...baseLicense,
        expiresAt: new Date(Date.now() - 1000),
      },
    });

    await expect(service.activate(mobileJwt, licenseKey, {})).rejects.toMatchObject({
      response: { code: 'LICENSE_EXPIRED' },
    });
  });

  it('rejects revoked licenses', async () => {
    mockTransaction({
      license: {
        ...baseLicense,
        status: LicenseStatus.REVOKED,
        revokedAt: new Date(),
      },
    });

    await expect(service.activate(mobileJwt, licenseKey, {})).rejects.toMatchObject({
      response: { code: 'LICENSE_REVOKED' },
    });
  });

  it('rejects activation on a revoked device', async () => {
    mockTransaction({ device: null });

    await expect(service.activate(mobileJwt, licenseKey, {})).rejects.toMatchObject({
      response: { code: 'DEVICE_REVOKED' },
    });
  });
});
