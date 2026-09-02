import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { appConfig, jwtConfig, securityConfig, supportConfig, telegramConfig } from './configuration';
import { storageConfig } from './storage.config';
import { envValidationSchema } from './env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, jwtConfig, securityConfig, supportConfig, telegramConfig, storageConfig],
      validationSchema: envValidationSchema,
      validationOptions: {
        abortEarly: false,
        convert: true,
        allowUnknown: true,
      },
    }),
  ],
})
export class EnvConfigModule {}
