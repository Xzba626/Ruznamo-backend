import type { VercelRequest, VercelResponse } from '@vercel/node';
import serverlessExpress from '@vendia/serverless-express';
import express from 'express';

type ServerlessHandler = ReturnType<typeof serverlessExpress>;

let cachedServer: ServerlessHandler | undefined;
let bootstrapError: Error | undefined;

async function createServerlessHandler(): Promise<ServerlessHandler> {
  const { NestFactory } = await import('@nestjs/core');
  const { ExpressAdapter } = await import('@nestjs/platform-express');
  const { AppModule } = await import('../dist/src/app.module');
  const { configureNestApplication } = await import('../dist/src/bootstrap');

  const expressApp = express();
  const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp), {
    bufferLogs: true,
  });

  await configureNestApplication(app);
  await app.init();

  return serverlessExpress({ app: expressApp });
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<unknown> {
  try {
    if (!cachedServer) {
      if (bootstrapError) {
        throw bootstrapError;
      }

      try {
        cachedServer = await createServerlessHandler();
      } catch (error) {
        bootstrapError = error instanceof Error ? error : new Error(String(error));
        throw bootstrapError;
      }
    }

    return cachedServer(req, res);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown serverless bootstrap error';

    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: {
          code: 'SERVERLESS_BOOTSTRAP_FAILED',
          message,
        },
        requestId: req.headers['x-request-id'] ?? 'unknown',
      });
    }

    return undefined;
  }
}
