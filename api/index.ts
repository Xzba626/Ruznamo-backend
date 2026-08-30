import type { VercelRequest, VercelResponse } from '@vercel/node';
import serverlessExpress from '@vendia/serverless-express';

type ServerlessHandler = ReturnType<typeof serverlessExpress>;

let cachedServer: ServerlessHandler | undefined;
let bootstrapError: Error | undefined;

async function createServerlessHandler(): Promise<ServerlessHandler> {
  const { NestFactory } = await import('@nestjs/core');
  const { AppModule } = await import('../dist/src/app.module');
  const { configureNestApplication } = await import('../dist/src/bootstrap');

  // NestJS 11 uses Express 5 — do NOT pass a separate Express 4 instance (breaks on Vercel).
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  await configureNestApplication(app);
  await app.init();

  const expressApp = app.getHttpAdapter().getInstance();
  return serverlessExpress({ app: expressApp });
}

function sendBootstrapError(res: VercelResponse, message: string, requestId: string): void {
  if (!res.headersSent) {
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVERLESS_BOOTSTRAP_FAILED',
        message,
      },
      requestId,
    });
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<unknown> {
  const requestId = String(req.headers['x-request-id'] ?? 'unknown');

  try {
    if (!cachedServer) {
      if (bootstrapError) {
        sendBootstrapError(res, bootstrapError.message, requestId);
        return undefined;
      }

      try {
        cachedServer = await createServerlessHandler();
      } catch (error) {
        bootstrapError = error instanceof Error ? error : new Error(String(error));
        console.error('[serverless] bootstrap failed:', bootstrapError.message, bootstrapError.stack);
        sendBootstrapError(res, bootstrapError.message, requestId);
        return undefined;
      }
    }

    return await cachedServer(req, res);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown serverless error';
    console.error('[serverless] request failed:', message);
    sendBootstrapError(res, message, requestId);
    return undefined;
  }
}
