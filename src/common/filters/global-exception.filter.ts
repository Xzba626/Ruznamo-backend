import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';

interface ErrorBody {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  constructor(private readonly configService: ConfigService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { requestId?: string }>();
    const requestId = request.requestId ?? 'unknown';
    const isProduction = this.configService.get<boolean>('app.isProduction', false);

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorBody: ErrorBody = {
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    };

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        errorBody = {
          code: HttpStatus[status] ?? 'HTTP_ERROR',
          message: exceptionResponse,
        };
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const payload = exceptionResponse as Record<string, unknown>;
        errorBody = {
          code: String(payload.code ?? payload.error ?? HttpStatus[status] ?? 'HTTP_ERROR'),
          message: String(payload.message ?? exception.message),
          details:
            payload.details && typeof payload.details === 'object'
              ? (payload.details as Record<string, unknown>)
              : undefined,
        };
      }
    } else if (exception instanceof Error) {
      this.logger.error(
        {
          requestId,
          message: exception.message,
          stack: isProduction ? undefined : exception.stack,
        },
        'Unhandled exception',
      );
    }

    if (!isProduction && exception instanceof Error && status >= 500) {
      errorBody.details = {
        ...(errorBody.details ?? {}),
        debugMessage: exception.message,
      };
    }

    response.status(status).json({
      success: false,
      error: errorBody,
      requestId,
    });
  }
}
