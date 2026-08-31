import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PasswordService } from './password.service';
import { TokenHashService } from './token-hash.service';
import { LicenseKeyService } from './license-key.service';

@Module({
  imports: [ConfigModule],
  providers: [PasswordService, TokenHashService, LicenseKeyService],
  exports: [PasswordService, TokenHashService, LicenseKeyService],
})
export class SecurityModule {}
