import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateReleaseDraftDto {
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  changelogRu?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  changelogTg?: string;

  @IsOptional()
  @IsBoolean()
  mandatory?: boolean;
}
