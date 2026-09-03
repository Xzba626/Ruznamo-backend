/**
 * Deterministic classification of internal/probe DeviceInstallation telemetry.
 * Only exclude when classification is unambiguous (probe-* version or AuthProbe* deviceName).
 * UNKNOWN / real customer versions must remain untouched.
 */
export function isProbeDeviceTelemetry(row: {
  appVersion?: string | null;
  appVersionName?: string | null;
  deviceName?: string | null;
}): boolean {
  const versions = [row.appVersion, row.appVersionName]
    .filter((v): v is string => Boolean(v && v.trim()))
    .map((v) => v.trim().toLowerCase());
  if (versions.some((v) => v.startsWith('probe-'))) {
    return true;
  }
  const deviceName = row.deviceName?.trim().toLowerCase() ?? '';
  return deviceName.startsWith('authprobe');
}

/** Prisma where fragment: customer DeviceInstallation rows only. */
export function customerDeviceWhere() {
  return {
    revokedAt: null,
    NOT: {
      OR: [
        { appVersion: { startsWith: 'probe-', mode: 'insensitive' as const } },
        { appVersionName: { startsWith: 'probe-', mode: 'insensitive' as const } },
        { deviceName: { startsWith: 'AuthProbe', mode: 'insensitive' as const } },
      ],
    },
  };
}
