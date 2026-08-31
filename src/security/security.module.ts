import { Module } from '@nestjs/common';
import { PasswordService } from './password.service';
import { TokenHashService } from './token-hash.service';

@Module({
  providers: [PasswordService, TokenHashService],
  exports: [PasswordService, TokenHashService],
})
export class SecurityModule {}
