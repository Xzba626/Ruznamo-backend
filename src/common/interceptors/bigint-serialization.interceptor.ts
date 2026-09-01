import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

function serializeBigInt(value: unknown): unknown {
  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (value instanceof Date) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(serializeBigInt);
  }

  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nested]) => [
        key,
        serializeBigInt(nested),
      ]),
    );
  }

  return value;
}

/** Ensures Prisma BigInt fields serialize safely in JSON responses. */
@Injectable()
export class BigIntSerializationInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map((data) => serializeBigInt(data)));
  }
}
