import { buildDeviceMetadataUpdate, formatAppVersionLabel } from './device-metadata.util';

describe('device-metadata.util', () => {
  it('prefers appVersionName and appVersionCode', () => {
    const update = buildDeviceMetadataUpdate({
      appVersionName: '1.0.9',
      appVersionCode: 10,
      appLocale: 'ru',
    });
    expect(update.appVersion).toBe('1.0.9');
    expect(update.appVersionCode).toBe(10);
    expect(update.appLocale).toBe('ru');
  });

  it('formats version label', () => {
    expect(
      formatAppVersionLabel({ appVersionName: '1.0.9', appVersionCode: 10 }),
    ).toBe('1.0.9 (10)');
  });

  it('returns null for unknown version metadata', () => {
    expect(formatAppVersionLabel({ appVersion: null, appVersionCode: null })).toBeNull();
  });
});
