import { IsString, MinLength } from 'class-validator';

export class ActivateLicenseDto {
  @IsString()
  @MinLength(8)
  licenseKey!: string;
}
