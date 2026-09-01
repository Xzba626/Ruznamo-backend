import { LicensesController } from './licenses.controller';
import { LicensesService } from './licenses.service';

describe('LicensesController', () => {
  const licensesService = {
    activate: jest.fn(),
    getMyLicenses: jest.fn(),
  };

  const controller = new LicensesController(licensesService as unknown as LicensesService);

  const mobileJwt = {
    sub: 'user_mobile',
    deviceId: 'device_1',
    installationId: 'inst-1',
    type: 'access' as const,
    aud: 'ruznamo-mobile',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('activate delegates to service with JWT user and license key', async () => {
    licensesService.activate.mockResolvedValue({ license: { id: 'lic_1' } });

    const req = { ip: '127.0.0.1', headers: { 'user-agent': 'jest' } } as never;
    const result = await controller.activate(mobileJwt, { licenseKey: 'test-key' }, req);

    expect(licensesService.activate).toHaveBeenCalledWith(
      mobileJwt,
      'test-key',
      { ipAddress: '127.0.0.1', userAgent: 'jest' },
    );
    expect(result).toEqual({ license: { id: 'lic_1' } });
  });

  it('me delegates to service with JWT user id', async () => {
    licensesService.getMyLicenses.mockResolvedValue({ items: [] });

    const result = await controller.me(mobileJwt);

    expect(licensesService.getMyLicenses).toHaveBeenCalledWith('user_mobile');
    expect(result).toEqual({ items: [] });
  });
});
