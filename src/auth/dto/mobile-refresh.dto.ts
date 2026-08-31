import { IsOptional, IsString, MinLength } from 'class-validator';

export class MobileRefreshDto {
  @IsString()
  @MinLength(16)
  refreshToken!: string;
}

export class MobileLogoutDto {
  @IsOptional()
  @IsString()
  @MinLength(16)
  refreshToken?: string;
}
