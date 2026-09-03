import { createHash } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import {
  extractApkSigningBlockCertificateDer,
  sha256HexOfDerCertificate,
} from './apk-signing-cert';

describe('apk-signing-cert', () => {
  const apkPath = 'D:/Ruznamo/dist/Ruznamo-debug-v1.0.12-code13.apk';
  const hasApk = existsSync(apkPath);

  (hasApk ? it : it.skip)('extracts v2/v3 signing certificate from controlled debug APK', () => {
    const apk = readFileSync(apkPath);
    const der = extractApkSigningBlockCertificateDer(apk);
    expect(der).not.toBeNull();
    expect(der!.length).toBeGreaterThan(64);
    const fingerprint = sha256HexOfDerCertificate(der!);
    expect(fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(fingerprint).not.toBe(createHash('sha256').update(apk).digest('hex'));
  });
});
