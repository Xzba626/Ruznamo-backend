import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { configureNestApplication } from './bootstrap';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  await configureNestApplication(app);

  const configService = app.get(ConfigService);
  const logger = app.get(Logger);
  const port = configService.get<number>('app.port', 3000);

  await app.listen(port);

  logger.log(`Ruznamo API listening on port ${port}`);
  logger.log(`Swagger UI: http://localhost:${port}/api/docs`);
}

void bootstrap();
