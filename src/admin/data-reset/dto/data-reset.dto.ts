import { IsEnum, IsString, MinLength } from 'class-validator';
import { DataResetScope } from '@prisma/client';

export class SetResetPasswordDto {
  @IsString()
  @MinLength(12)
  newPassword!: string;

  @IsString()
  @MinLength(12)
  confirmPassword!: string;
}

export class ChangeResetPasswordDto {
  @IsString()
  @MinLength(1)
  currentPassword!: string;

  @IsString()
  @MinLength(12)
  newPassword!: string;

  @IsString()
  @MinLength(12)
  confirmPassword!: string;
}

export class DataResetDryRunDto {
  @IsEnum(DataResetScope)
  scope!: DataResetScope;
}

export class ExecuteDataResetDto {
  @IsEnum(DataResetScope)
  scope!: DataResetScope;

  @IsString()
  @MinLength(1)
  resetPassword!: string;

  @IsString()
  @MinLength(1)
  confirmationPhrase!: string;
}
