import { customerDeviceWhere, isProbeDeviceTelemetry } from './probe-device-filter.util';

describe('probe device telemetry filter', () => {
  it('classifies known probe versions and AuthProbe device names', () => {
    expect(isProbeDeviceTelemetry({ appVersion: 'probe-telegram-auth' })).toBe(true);
    expect(isProbeDeviceTelemetry({ appVersion: 'probe-telegram-auth-ext' })).toBe(true);
    expect(isProbeDeviceTelemetry({ appVersionName: 'probe-telegram-auth-b' })).toBe(true);
    expect(isProbeDeviceTelemetry({ deviceName: 'AuthProbeDevice' })).toBe(true);
    expect(isProbeDeviceTelemetry({ deviceName: 'AuthProbeExtA' })).toBe(true);
  });

  it('leaves real and unknown telemetry untouched', () => {
    expect(isProbeDeviceTelemetry({ appVersion: '1.0.10', appVersionName: '1.0.10' })).toBe(false);
    expect(isProbeDeviceTelemetry({ appVersion: null, appVersionName: null, deviceName: null })).toBe(
      false,
    );
    expect(isProbeDeviceTelemetry({ appVersion: 'production-build', deviceName: 'Pixel 7' })).toBe(
      false,
    );
  });

  it('builds a customer-only Prisma where fragment', () => {
    const where = customerDeviceWhere();
    expect(where.revokedAt).toBeNull();
    expect(where.NOT).toBeDefined();
  });
});
