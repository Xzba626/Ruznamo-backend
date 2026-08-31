import { IsString, MinLength } from 'class-validator';

export class RevokeDeviceDto {
  @IsString()
  @MinLength(1)
  deviceId!: string;
}
