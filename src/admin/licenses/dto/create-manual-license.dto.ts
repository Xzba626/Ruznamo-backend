import { BillingPeriod, PlanCode } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateManualLicenseDto {
  @IsEnum(PlanCode)
  planCode!: PlanCode;

  @IsEnum(BillingPeriod)
  billingPeriod!: BillingPeriod;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  customerLabel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  adminNote?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  linkTelegramUserId?: string;
}
