import { IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { Platform } from '@prisma/client';

export class RegisterDeviceMetadataDto {
  @IsUUID('4')
  installationId!: string;

  @IsEnum(Platform)
  platform!: Platform;

  @IsString()
  @MinLength(1)
  @MaxLength(32)
  appVersion!: string;

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
