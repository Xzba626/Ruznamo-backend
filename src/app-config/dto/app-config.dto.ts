import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { Platform } from '@prisma/client';

export class AppConfigQueryDto {
  @ApiPropertyOptional({ enum: Platform, default: Platform.ANDROID })
  @IsOptional()
  @IsEnum(Platform)
  platform?: Platform = Platform.ANDROID;

  @ApiPropertyOptional({
    example: '1.0.0',
    description: 'Current Android app version for update policy',
  })
  @IsOptional()
  @IsString()
  appVersion?: string;
}

export class MaintenanceConfigDto {
  @ApiProperty()
  enabled!: boolean;

  @ApiPropertyOptional({ nullable: true })
  message!: string | null;
}

export class AndroidConfigDto {
  @ApiProperty({ example: '1.0.0' })
  latestVersion!: string;

  @ApiProperty({ example: '1.0.0' })
  minimumSupportedVersion!: string;

  @ApiPropertyOptional({ nullable: true })
  updateUrl!: string | null;

  @ApiProperty({ description: 'Mandatory update required (hard block)' })
  forceUpdate!: boolean;

  @ApiProperty({ description: 'Server policy: client must update to continue' })
  updateRequired!: boolean;

  @ApiProperty({ description: 'Server policy: newer version available (soft prompt)' })
  updateRecommended!: boolean;

  @ApiPropertyOptional({ nullable: true })
  releaseNotes!: string | null;
}

export class AnnouncementConfigDto {
  @ApiProperty()
  enabled!: boolean;

  @ApiPropertyOptional({ nullable: true })
  title!: string | null;

  @ApiPropertyOptional({ nullable: true })
  message!: string | null;

  @ApiPropertyOptional({ enum: ['INFO', 'WARNING', 'UPDATE', 'MAINTENANCE'], nullable: true })
  type!: string | null;
}

export class AppConfigResponseDto {
  @ApiProperty({
    example: '1',
    description: 'Increment when public config shape or policy changes',
  })
  configVersion!: string;

  @ApiProperty({ type: MaintenanceConfigDto })
  maintenance!: MaintenanceConfigDto;

  @ApiProperty({ type: AndroidConfigDto })
  android!: AndroidConfigDto;

  @ApiProperty({ type: AnnouncementConfigDto })
  announcement!: AnnouncementConfigDto;

  @ApiProperty({ example: '2026-08-30T10:00:00.000Z' })
  serverTime!: string;
}
