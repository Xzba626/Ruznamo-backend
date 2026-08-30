import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { Express, Request, Response } from 'express';

let cachedExpressApp: Express | undefined;
let bootstrapError: Error | undefined;

async function getExpressApp(): Promise<Express> {
  const { NestFactory } = await import('@nestjs/core');
  const { AppModule } = await import('../dist/src/app.module');
  const { configureNestApplication } = await import('../dist/src/bootstrap');

  // NestJS 11 uses Express 5 — let Nest create the HTTP server (no separate Express 4 app).
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  await configureNestApplication(app);
  await app.init();

  return app.getHttpAdapter().getInstance() as Express;
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

function runExpress(expressApp: Express, req: VercelRequest, res: VercelResponse): Promise<void> {
  return new Promise((resolve, reject) => {
    res.once('finish', resolve);
    res.once('close', resolve);
    res.once('error', reject);

    expressApp(
      req as unknown as Request,
      res as unknown as Response,
      (err: unknown) => {
        if (err) {
          reject(err);
        }
      },
    );
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const requestId = String(req.headers['x-request-id'] ?? 'unknown');

  try {
    if (!cachedExpressApp) {
      if (bootstrapError) {
        sendBootstrapError(res, bootstrapError.message, requestId);
        return;
      }

      try {
        cachedExpressApp = await getExpressApp();
      } catch (error) {
        bootstrapError = error instanceof Error ? error : new Error(String(error));
        console.error('[serverless] bootstrap failed:', bootstrapError.message, bootstrapError.stack);
        sendBootstrapError(res, bootstrapError.message, requestId);
        return;
      }
    }

    await runExpress(cachedExpressApp, req, res);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown serverless error';
    console.error('[serverless] request failed:', message);
    sendBootstrapError(res, message, requestId);
  }
}
