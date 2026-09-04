import { ApkInspectorService } from './apk-inspector.service';

describe('ApkInspectorService', () => {
  it('rejects tiny buffers as INVALID_APK', async () => {
    const service = new ApkInspectorService({
      get: (_k: string, fallback?: string) => fallback,
    } as never);
    await expect(service.inspect(Buffer.from('nope'))).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'INVALID_APK' }),
    });
  });
});
