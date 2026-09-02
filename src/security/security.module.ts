import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PasswordService } from './password.service';
import { ResetPasswordService } from './reset-password.service';
import { TokenHashService } from './token-hash.service';
import { LicenseKeyService } from './license-key.service';

@Module({
  imports: [ConfigModule],
  providers: [PasswordService, ResetPasswordService, TokenHashService, LicenseKeyService],
  exports: [PasswordService, ResetPasswordService, TokenHashService, LicenseKeyService],
})
export class SecurityModule {}
