/**
 * Guards against serverless cold-start DI failures (e.g. missing AuditModule import).
 * Runs compiled output like api/index.ts on Vercel.
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureNestApplication } from './bootstrap';

describe('Application bootstrap', () => {
  it('initializes Nest application with all modules', async () => {
    const app = await NestFactory.create(AppModule, { bufferLogs: true });
    await configureNestApplication(app);
    await app.init();
    await app.close();
  }, 60_000);
});
