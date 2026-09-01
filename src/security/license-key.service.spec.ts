import { LicenseKeyService } from '../security/license-key.service';

describe('LicenseKeyService', () => {
  const configService = {
    get: jest.fn().mockReturnValue('test-pepper-minimum-32-characters-long'),
  };

  const service = new LicenseKeyService(configService as never);

  it('generates 64-character hex keys', () => {
    const key = service.generateRawKey();
    expect(key).toHaveLength(64);
    expect(key).toMatch(/^[0-9a-f]{64}$/);
  });

  it('hashes normalized keys consistently', () => {
    const raw = 'a'.repeat(64);
    const hash1 = service.hashKey(service.normalizeKey(raw));
    const hash2 = service.hashKey(service.normalizeKey(raw.toUpperCase()));
    expect(hash1).toBe(hash2);
  });
});
