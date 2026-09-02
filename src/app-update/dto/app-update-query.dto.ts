import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { Platform } from '@prisma/client';

export class AppUpdateQueryDto {
  @IsOptional()
  @IsEnum(Platform)
  platform?: Platform;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  versionCode?: number;

  @IsOptional()
  @IsString()
  locale?: string;
}
