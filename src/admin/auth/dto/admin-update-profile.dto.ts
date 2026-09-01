import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class AdminUpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  displayName?: string;
}
