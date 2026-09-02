import { IsEnum, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min, MinLength } from 'class-validator';
import { Platform } from '@prisma/client';

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
}
