import { CallHandler, ExecutionContext } from '@nestjs/common';
import { of } from 'rxjs';
import { BigIntSerializationInterceptor } from './bigint-serialization.interceptor';

describe('BigIntSerializationInterceptor', () => {
  const interceptor = new BigIntSerializationInterceptor();

  it('serializes bigint values in nested objects', (done) => {
    const context = {} as ExecutionContext;
    const next: CallHandler = {
      handle: () => of({ telegram: { telegramId: BigInt('123456789') } }),
    };

    interceptor.intercept(context, next).subscribe((result) => {
      expect(result).toEqual({ telegram: { telegramId: '123456789' } });
      done();
    });
  });
});
