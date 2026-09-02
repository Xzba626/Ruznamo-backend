import { Prisma } from '@prisma/client';
import { BillingPeriod, LicenseIssueSource, LicenseStatus } from '@prisma/client';
import { LicenseIssuanceService } from './license-issuance.service';

describe('LicenseIssuanceService', () => {
  const prisma = {
    license: { findUnique: jest.fn(), findUniqueOrThrow: jest.fn(), count: jest.fn() },
    notificationOutbox: { findFirst: jest.fn() },
    $transaction: jest.fn(),
  };

  const licenseKeyService = {
    generateRawKey: jest.fn().mockReturnValue('a'.repeat(64)),
    normalizeKey: jest.fn((k: string) => k),
    hashKey: jest.fn().mockReturnValue('hash'),
    prefix: jest.fn().mockReturnValue('aaaaaaaa'),
  };

  const service = new LicenseIssuanceService(prisma as never, licenseKeyService as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.license.findUnique.mockResolvedValue(null);
    prisma.notificationOutbox.findFirst.mockResolvedValue(null);
    prisma.license.count.mockResolvedValue(0);
  });

  it('returns existing license when orderId already has a license', async () => {
    prisma.license.findUnique.mockResolvedValue({
      id: 'lic_existing',
      keyPrefix: 'bbbbbbbb',
      expiresAt: new Date('2027-06-01'),
    });

    const result = await service.issueLicense({
      planId: 'plan_1',
      userId: 'usr_1',
      orderId: 'ord_1',
      issueSource: LicenseIssueSource.TELEGRAM_PAYMENT,
      billingPeriod: BillingPeriod.MONTHLY,
      eventReason: 'test',
    });

    expect(result.alreadyExisted).toBe(true);
    expect(result.licenseId).toBe('lic_existing');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('treats P2002 unique orderId collision as duplicate issuance', async () => {
    const uniqueError = new Prisma.PrismaClientKnownRequestError('Unique constraint', {
      code: 'P2002',
      clientVersion: '6.0.0',
    });

    prisma.$transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) =>
      cb({
        license: {
          create: jest.fn().mockRejectedValue(uniqueError),
          findUnique: jest.fn().mockResolvedValue({
            id: 'lic_existing',
            keyPrefix: 'cccccccc',
            expiresAt: new Date('2027-08-01'),
          }),
        },
        licenseEvent: { create: jest.fn() },
      }),
    );
    prisma.notificationOutbox.findFirst.mockResolvedValue({
      payload: { licenseKey: 'stored-key' },
    });

    const result = await service.issueLicense({
      planId: 'plan_1',
      userId: 'usr_1',
      orderId: 'ord_1',
      issueSource: LicenseIssueSource.TELEGRAM_PAYMENT,
      billingPeriod: BillingPeriod.MONTHLY,
      eventReason: 'test',
    });

    expect(result.alreadyExisted).toBe(true);
    expect(result.licenseId).toBe('lic_existing');
    expect(result.licenseKey).toBe('stored-key');
  });

  it('creates a new license when no duplicate exists', async () => {
    prisma.$transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) =>
      cb({
        license: {
          create: jest.fn().mockResolvedValue({
            id: 'lic_new',
            keyPrefix: 'aaaaaaaa',
            expiresAt: new Date('2027-01-01'),
          }),
        },
        licenseEvent: { create: jest.fn() },
      }),
    );

    const result = await service.issueLicense({
      planId: 'plan_1',
      userId: 'usr_1',
      orderId: 'ord_new',
      issueSource: LicenseIssueSource.ADMIN_MANUAL,
      billingPeriod: BillingPeriod.MONTHLY,
      eventReason: 'admin_manual',
    });

    expect(result.alreadyExisted).toBe(false);
    expect(result.licenseId).toBe('lic_new');
    expect(result.licenseKey).toHaveLength(64);
  });

  it('calculates expiry for monthly and yearly billing periods', () => {
    const start = new Date('2026-01-01T00:00:00.000Z');
    const monthly = service.calculateExpiresAt(start, BillingPeriod.MONTHLY);
    const yearly = service.calculateExpiresAt(start, BillingPeriod.YEARLY);

    expect(monthly.getUTCDate()).toBe(31);
    expect(yearly.getUTCDate()).toBe(1);
    expect(yearly.getUTCFullYear()).toBe(2027);
  });
});
