import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';

export class AdminTelegramRebindVerifyDto {
  @ApiProperty({ description: '6-digit OTP from Telegram bot' })
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  otp!: string;
}
