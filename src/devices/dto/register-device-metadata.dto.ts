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

/** Authenticated device metadata sync (additional / returning device). */
export class RegisterDeviceMetadataDto {
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

  @IsOptional()
  @IsEnum(UserCategory)
  category?: UserCategory;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  roleId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  localLicenseState?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  localAccessState?: string;
}
