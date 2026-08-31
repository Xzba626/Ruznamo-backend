import { IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { Platform, UserCategory } from '@prisma/client';

export class RegisterDeviceDto {
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
  @IsEnum(UserCategory)
  category?: UserCategory;
}
