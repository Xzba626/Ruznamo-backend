import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const configService = app.get(ConfigService);
  const logger = app.get(Logger);
  app.useLogger(logger);

  app.use(
    helmet({
      contentSecurityPolicy: configService.get<boolean>('app.isProduction') ? undefined : false,
    }),
  );

  app.enableCors({
    origin: configService.get<string[]>('app.corsOrigins'),
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

  const port = configService.get<number>('app.port', 3000);
  await app.listen(port);

  logger.log(`Ruznamo API listening on port ${port}`);
  logger.log(`Swagger UI: http://localhost:${port}/api/docs`);
}

void bootstrap();
