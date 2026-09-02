import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuditModule } from '../audit/audit.module';
import { DeviceTelemetryModule } from '../devices/device-telemetry.module';
import { LicensesModule } from '../licenses/licenses.module';
import { SecurityModule } from '../security/security.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TelegramAuthService } from './telegram-auth.service';
import { MobileJwtAuthGuard } from './guards/mobile-jwt-auth.guard';
import { MobileJwtStrategy } from './strategies/mobile-jwt.strategy';

@Module({
  imports: [
    forwardRef(() => LicensesModule),
    PassportModule.register({ defaultStrategy: 'mobile-jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('jwt.accessSecret'),
      }),
    }),
    SecurityModule,
    AuditModule,
    DeviceTelemetryModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, TelegramAuthService, MobileJwtStrategy, MobileJwtAuthGuard],
  exports: [AuthService, TelegramAuthService, MobileJwtAuthGuard],
})
export class AuthModule {}
