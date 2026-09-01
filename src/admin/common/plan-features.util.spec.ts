import { readMaxDevicesFromFeatures } from './plan-features.util';

describe('readMaxDevicesFromFeatures', () => {
  it('reads max_devices feature', () => {
    expect(readMaxDevicesFromFeatures([{ key: 'max_devices', value: '2' }])).toBe(2);
  });

  it('falls back to legacy device_limit key', () => {
    expect(readMaxDevicesFromFeatures([{ key: 'device_limit', value: '3' }])).toBe(3);
  });

  it('returns fallback when feature missing', () => {
    expect(readMaxDevicesFromFeatures([], 1)).toBe(1);
  });
});
