import { ApiProperty } from '@nestjs/swagger';
import { TelegramAuthPurpose } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class CreateTelegramAuthChallengeDto {
  @ApiProperty({ enum: TelegramAuthPurpose })
  @IsEnum(TelegramAuthPurpose)
  purpose!: TelegramAuthPurpose;

  @ApiProperty({ required: false, description: 'Required when purpose is LINK_ACCOUNT' })
  @IsOptional()
  @IsString()
  licenseId?: string;
}

export class VerifyTelegramAuthDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  challengeId!: string;

  @ApiProperty({ description: '6-digit confirmation code from Telegram bot' })
  @IsString()
  @Matches(/^\d{6}$/, { message: 'code must be a 6-digit number' })
  code!: string;
}

export class RecoveryGrantQueryDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  recoveryGrantId!: string;
}

export class RevealLicenseKeyDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  recoveryGrantId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  licenseId!: string;
}

export class ActivateViaTelegramDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  recoveryGrantId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  licenseId!: string;
}

export class ReplaceDeviceViaGrantDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  recoveryGrantId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  licenseId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  oldDeviceId!: string;
}
