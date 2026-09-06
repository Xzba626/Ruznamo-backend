import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Platform, UserCategory } from '@prisma/client';

/**
 * Mobile device registration / first-install payload.
 * Extra fields must stay optional for older clients (contract versioning).
 */
export class RegisterDeviceDto {
  @IsUUID('4')
  installationId!: string;

  @IsEnum(Platform)
  platform!: Platform;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  appVersion?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  appVersionName?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  appVersionCode?: number;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  appLocale?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  appLanguage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  deviceName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  deviceManufacturer?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  deviceModel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  androidOsVersion?: string;

  @IsOptional()
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

  /** Canonical backend category when known (TEACHER, …). */
  @IsOptional()
  @IsEnum(UserCategory)
  category?: UserCategory;

  /**
   * Canonical or local role id (TEACHER / teacher).
   * Accepted as string so Android local ids are not rejected by ValidationPipe.
   */
  @IsOptional()
  @IsString()
  @MaxLength(32)
  roleId?: string;

  /** User-set display name only; never invent from contacts/Google. */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  displayName?: string;

  /** Client-reported license UX — never authoritative. */
  @IsOptional()
  @IsString()
  @MaxLength(32)
  localLicenseState?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  localAccessState?: string;
}
