import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export enum AnnouncementType {
  INFO = 'INFO',
  WARNING = 'WARNING',
  UPDATE = 'UPDATE',
  MAINTENANCE = 'MAINTENANCE',
}

export class UpdateAndroidAppConfigDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  latestVersion?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  minimumSupportedVersion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  updateUrl?: string;

  @IsOptional()
  @IsBoolean()
  forceUpdate?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  releaseNotes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  releaseNotesTj?: string;
}

export class UpdateAdminAppConfigDto {
  @IsOptional()
  @IsString()
  @MaxLength(16)
  configVersion?: string;

  @IsOptional()
  @IsBoolean()
  maintenanceEnabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  maintenanceMessage?: string;

  @IsOptional()
  @IsBoolean()
  announcementEnabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  announcementTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  announcementMessage?: string;

  @IsOptional()
  @IsEnum(AnnouncementType)
  announcementType?: AnnouncementType;

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateAndroidAppConfigDto)
  android?: UpdateAndroidAppConfigDto;
}
