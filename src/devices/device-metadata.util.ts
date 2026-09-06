export interface DeviceMetadataInput {
  appVersion?: string | null;
  appVersionName?: string | null;
  appVersionCode?: number | null;
  appLocale?: string | null;
  appLanguage?: string | null;
  deviceName?: string | null;
  deviceManufacturer?: string | null;
  deviceModel?: string | null;
  androidOsVersion?: string | null;
  sdkLevel?: number | null;
  themeMode?: string | null;
  packageName?: string | null;
  localLicenseState?: string | null;
  localAccessState?: string | null;
  clientReportedAccessState?: string | null;
}

type MetadataUpdate = {
  appVersion?: string | null;
  appVersionName?: string | null;
  appVersionCode?: number | null;
  appLocale?: string | null;
  appLanguage?: string | null;
  deviceName?: string | null;
  deviceManufacturer?: string | null;
  deviceModel?: string | null;
  androidOsVersion?: string | null;
  sdkLevel?: number | null;
  themeMode?: string | null;
  packageName?: string | null;
  clientReportedAccessState?: string | null;
  clientReportedAccessAt?: Date;
};

/** Only includes fields that were present on the input (avoids wiping DB on partial sync). */
export function buildDeviceMetadataUpdate(input: DeviceMetadataInput): MetadataUpdate {
  const out: MetadataUpdate = {};

  const versionName = input.appVersionName?.trim() || input.appVersion?.trim() || undefined;
  if (input.appVersionName !== undefined || input.appVersion !== undefined) {
    out.appVersion = versionName ?? input.appVersion ?? null;
    out.appVersionName = versionName ?? null;
  }
  if (input.appVersionCode !== undefined) {
    out.appVersionCode = input.appVersionCode;
  }
  if (input.appLocale !== undefined || input.appLanguage !== undefined) {
    out.appLocale = input.appLocale?.trim() || input.appLanguage?.trim() || null;
    out.appLanguage = input.appLanguage?.trim() || input.appLocale?.trim() || null;
  }
  if (input.deviceName !== undefined) out.deviceName = input.deviceName;
  if (input.deviceManufacturer !== undefined) out.deviceManufacturer = input.deviceManufacturer;
  if (input.deviceModel !== undefined) out.deviceModel = input.deviceModel;
  if (input.androidOsVersion !== undefined) out.androidOsVersion = input.androidOsVersion;
  if (input.sdkLevel !== undefined) out.sdkLevel = input.sdkLevel;
  if (input.themeMode !== undefined) {
    out.themeMode = input.themeMode?.trim().toUpperCase() || null;
  }
  if (input.packageName !== undefined) {
    out.packageName = input.packageName?.trim() || null;
  }

  const clientStateRaw =
    input.clientReportedAccessState?.trim() ||
    input.localLicenseState?.trim() ||
    input.localAccessState?.trim() ||
    null;
  if (
    input.clientReportedAccessState !== undefined ||
    input.localLicenseState !== undefined ||
    input.localAccessState !== undefined
  ) {
    if (clientStateRaw) {
      out.clientReportedAccessState = clientStateRaw.toUpperCase().replace(/-/g, '_');
      out.clientReportedAccessAt = new Date();
    }
  }

  return out;
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
