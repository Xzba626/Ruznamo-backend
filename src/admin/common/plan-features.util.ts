export function readMaxDevicesFromFeatures(
  features: Array<{ key: string; value: string }>,
  fallback = 1,
): number | null {
  const feature = features.find((f) => f.key === 'max_devices' || f.key === 'device_limit');
  if (!feature) {
    return fallback;
  }

  const parsed = Number.parseInt(feature.value, 10);
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : null;
}
