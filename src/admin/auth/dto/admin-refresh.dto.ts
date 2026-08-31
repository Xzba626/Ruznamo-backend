import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class AdminRefreshDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  refreshToken!: string;
}

export class AdminLogoutDto {
  @ApiProperty({ required: false })
  @IsString()
  @MaxLength(512)
  refreshToken?: string;
}
