import { describe, expect, it } from 'vitest';
import { localizeError } from './errors';

describe('release upload error localization', () => {
  it('maps APK pipeline codes to Russian contextual messages', () => {
    expect(localizeError('APK_INSPECT_FAILED')).toMatch(/проверить|обработку/i);
    expect(localizeError('APK_PACKAGE_MISMATCH')).toMatch(/Пакет/);
    expect(localizeError('SIGNING_POLICY_NOT_CONFIGURED')).toMatch(/подпись/);
    expect(localizeError('MANIFEST_SIGNING_NOT_CONFIGURED')).toMatch(/manifest/i);
    expect(localizeError('OBJECT_STORAGE_NOT_CONFIGURED')).toMatch(/Хранилище/);
    expect(localizeError('BLOB_GET_FAILED')).toMatch(/прочитать|хранилищ/i);
  });

  it('does not leave APK_INSPECT_FAILED as generic internal error', () => {
    expect(localizeError('APK_INSPECT_FAILED')).not.toBe('Внутренняя ошибка сервера.');
    expect(localizeError('INTERNAL_ERROR')).toBe('Внутренняя ошибка сервера.');
  });
});
