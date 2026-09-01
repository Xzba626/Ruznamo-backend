import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { isAllowedCorsOrigin } from './config/cors';

export async function configureNestApplication(app: INestApplication): Promise<void> {
  const configService = app.get(ConfigService);
  const logger = app.get(Logger);
  app.useLogger(logger);

  app.use(
    helmet({
      contentSecurityPolicy: configService.get<boolean>('app.isProduction') ? undefined : false,
    }),
  );

  const corsOrigins = configService.get<string[]>('app.corsOrigins', []);

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      if (isAllowedCorsOrigin(origin ?? '', corsOrigins)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Ruznamo API')
    .setDescription('Commercial backend API for Ruznamo Android and Admin Panel')
    .setVersion('1.0.0')
    .addBearerAuth()
    .addServer(configService.get<string>('app.apiBaseUrl') ?? 'http://localhost:3000')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    jsonDocumentUrl: 'api/docs-json',
  });
}
