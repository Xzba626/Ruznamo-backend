import { IsString, MinLength } from 'class-validator';

export class CreateTelegramLinkChallengeDto {
  @IsString()
  @MinLength(8)
  licenseId!: string;
}
