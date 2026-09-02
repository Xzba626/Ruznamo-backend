import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';

export class MobileRefreshDto {
  @IsString()
  @MinLength(16)
  refreshToken!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
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
  deviceManufacturer?: string;

  @IsOptional()
  @IsString()
  deviceModel?: string;

  @IsOptional()
  @IsString()
  androidOsVersion?: string;
}

export class MobileLogoutDto {
  @IsOptional()
  @IsString()
  @MinLength(16)
  refreshToken?: string;
}
