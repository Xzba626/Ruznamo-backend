import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Optional telemetry on entitlements GET.
 * Prefer body-based sync for large payloads; query kept for backward compatibility.
 * Cadence (client): first launch, version change, license change, throttled while in use —
 * not every minute.
 */
export class DeviceTelemetryQueryDto {
  @IsOptional()
  @IsString()
  appVersion?: string;

  @IsOptional()
  @IsString()
  appVersionName?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  appVersionCode?: number;

  @IsOptional()
  @IsString()
  appLocale?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  appLanguage?: string;

  @IsOptional()
  @IsString()
  deviceManufacturer?: string;

  @IsOptional()
  @IsString()
  deviceModel?: string;

  @IsOptional()
  @IsString()
  androidOsVersion?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(99)
  sdkLevel?: number;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  themeMode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  packageName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  localLicenseState?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  localAccessState?: string;
}
