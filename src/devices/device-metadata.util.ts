export interface DeviceMetadataInput {
  appVersion?: string | null;
  appVersionName?: string | null;
  appVersionCode?: number | null;
  appLocale?: string | null;
  deviceName?: string | null;
  deviceManufacturer?: string | null;
  deviceModel?: string | null;
  androidOsVersion?: string | null;
}

export function buildDeviceMetadataUpdate(input: DeviceMetadataInput): {
  appVersion: string | null | undefined;
  appVersionName: string | null | undefined;
  appVersionCode: number | null | undefined;
  appLocale: string | null | undefined;
  deviceName?: string | null;
  deviceManufacturer?: string | null;
  deviceModel?: string | null;
  androidOsVersion?: string | null;
} {
  const versionName = input.appVersionName?.trim() || input.appVersion?.trim() || undefined;
  const versionCode =
    input.appVersionCode !== undefined && input.appVersionCode !== null
      ? input.appVersionCode
      : undefined;

  return {
    appVersion: versionName ?? input.appVersion,
    appVersionName: versionName ?? null,
    appVersionCode: versionCode ?? null,
    appLocale: input.appLocale?.trim() || null,
    deviceName: input.deviceName,
    deviceManufacturer: input.deviceManufacturer,
    deviceModel: input.deviceModel,
    androidOsVersion: input.androidOsVersion,
  };
}

export function formatAppVersionLabel(device: {
  appVersionName?: string | null;
  appVersionCode?: number | null;
  appVersion?: string | null;
}): string | null {
  const name = device.appVersionName ?? device.appVersion;
  if (!name && (device.appVersionCode === null || device.appVersionCode === undefined)) {
    return null;
  }
  if (name && device.appVersionCode !== null && device.appVersionCode !== undefined) {
    return `${name} (${device.appVersionCode})`;
  }
  return name ?? null;
}
