import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { UserCategory } from '@prisma/client';

export class UpdateAccountDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  displayName?: string;

  @IsOptional()
  @IsEnum(UserCategory)
  category?: UserCategory;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;
}
