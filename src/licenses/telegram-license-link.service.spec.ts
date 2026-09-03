import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { LicenseStatus } from '@prisma/client';
import { TelegramLicenseLinkService } from './telegram-license-link.service';

describe('TelegramLicenseLinkService holder revoke', () => {
  const prisma = {
    license: { findUnique: jest.fn() },
    licenseActivation: { findFirst: jest.fn(), count: jest.fn() },
    $transaction: jest.fn(),
    deviceInstallation: { update: jest.fn() },
    refreshToken: { updateMany: jest.fn() },
    licenseEvent: { create: jest.fn() },
  };

  const auditService = { log: jest.fn() };

  let service: TelegramLicenseLinkService;

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => Promise<void>) => fn(prisma));
    prisma.licenseActivation.count.mockResolvedValue(2);
    prisma.license.findUnique.mockResolvedValue({
      id: 'lic_1',
      status: LicenseStatus.ACTIVE,
      holderTelegramAccountId: 'tg_holder',
      plan: { features: [{ key: 'max_devices', value: '2', valueType: 'INT' }] },
    });
    prisma.licenseActivation.findFirst.mockResolvedValue({
      id: 'act_1',
      device: { revokedAt: null },
    });

    const { TelegramLicenseLinkService: Svc } = await import('./telegram-license-link.service');
    service = new Svc(
      prisma as never,
      { get: jest.fn() } as never,
      auditService as never,
    );
  });

  it('revokes device, refresh tokens, and returns updated slot usage', async () => {
    const result = await service.revokeDeviceAsHolder('tg_holder', 'lic_1', 'dev_1');

    expect(result.devicesUsedBefore).toBe(2);
    expect(result.devicesUsedAfter).toBe(1);
    expect(result.deviceLimit).toBe(2);
    expect(prisma.deviceInstallation.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'dev_1' }, data: expect.objectContaining({ revokedAt: expect.any(Date) }) }),
    );
    expect(prisma.refreshToken.updateMany).toHaveBeenCalled();
  });

  it('rejects revoke from non-holder', async () => {
    await expect(service.revokeDeviceAsHolder('other', 'lic_1', 'dev_1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rejects idempotent revoke when device already revoked', async () => {
    prisma.licenseActivation.findFirst.mockResolvedValue({
      id: 'act_1',
      device: { revokedAt: new Date() },
    });

    await expect(service.revokeDeviceAsHolder('tg_holder', 'lic_1', 'dev_1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
