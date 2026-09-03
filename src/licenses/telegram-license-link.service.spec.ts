import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { LicenseActivationRevokeReason, LicenseStatus } from '@prisma/client';
import { TelegramLicenseLinkService } from './telegram-license-link.service';

describe('TelegramLicenseLinkService holder revoke (slot model)', () => {
  const prisma = {
    license: { findUnique: jest.fn() },
    licenseActivation: { findFirst: jest.fn(), count: jest.fn(), update: jest.fn() },
    $transaction: jest.fn(),
    licenseEvent: { create: jest.fn() },
    deviceInstallation: { update: jest.fn() },
    refreshToken: { updateMany: jest.fn() },
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
    service = new Svc(prisma as never, { get: jest.fn() } as never, auditService as never);
  });

  it('soft-revokes LicenseActivation only — does NOT revoke DeviceInstallation', async () => {
    const result = await service.revokeDeviceAsHolder('tg_holder', 'lic_1', 'dev_1');

    expect(result.devicesUsedBefore).toBe(2);
    expect(result.devicesUsedAfter).toBe(1);
    expect(prisma.licenseActivation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'act_1' },
        data: expect.objectContaining({
          revokeReason: LicenseActivationRevokeReason.HOLDER_DISCONNECT,
        }),
      }),
    );
    expect(prisma.deviceInstallation.update).not.toHaveBeenCalled();
    expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
  });

  it('rejects revoke from non-holder', async () => {
    await expect(service.revokeDeviceAsHolder('other', 'lic_1', 'dev_1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rejects when activation already soft-revoked', async () => {
    prisma.licenseActivation.findFirst.mockResolvedValue(null);
    await expect(service.revokeDeviceAsHolder('tg_holder', 'lic_1', 'dev_1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
