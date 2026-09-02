import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

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
  deviceManufacturer?: string;

  @IsOptional()
  @IsString()
  deviceModel?: string;

  @IsOptional()
  @IsString()
  androidOsVersion?: string;
}
