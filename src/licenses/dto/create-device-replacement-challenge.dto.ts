import { IsString, MinLength } from 'class-validator';

export class CreateDeviceReplacementChallengeDto {
  @IsString()
  @MinLength(8)
  licenseKey!: string;
}
