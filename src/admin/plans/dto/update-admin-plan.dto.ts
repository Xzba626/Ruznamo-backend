import { ApiPropertyOptional } from '@nestjs/swagger';
import { BillingPeriod } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsNumberString, IsOptional, ValidateNested } from 'class-validator';

export class UpdatePlanPriceDto {
  @ApiPropertyOptional({ enum: BillingPeriod })
  @IsEnum(BillingPeriod)
  billingPeriod!: BillingPeriod;

  @ApiPropertyOptional({ example: '15.00' })
  @IsNumberString()
  amount!: string;
}

export class UpdateAdminPlanDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ type: [UpdatePlanPriceDto] })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => UpdatePlanPriceDto)
  prices?: UpdatePlanPriceDto[];
}
