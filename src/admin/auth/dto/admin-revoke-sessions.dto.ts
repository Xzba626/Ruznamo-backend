import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class AdminRevokeSessionsDto {
  @ApiPropertyOptional({ description: 'Current refresh token to keep active' })
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
