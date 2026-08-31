import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class AdminLoginDto {
  @ApiProperty({ example: 'owner@ruznamo.local' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  username!: string;

  @ApiProperty({ example: 'your-secure-password' })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}
