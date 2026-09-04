import { ServiceUnavailableException } from '@nestjs/common';
import { ReleaseManifestSignerService } from './release-manifest.signer.service';
import { generateEphemeralEd25519KeyPair } from './release-manifest.crypto';

describe('ReleaseManifestSignerService', () => {
  const signer = new ReleaseManifestSignerService();
  const keys = generateEphemeralEd25519KeyPair();

  beforeEach(() => {
    signer.resetCacheForTests();
    delete process.env.ANDROID_RELEASE_MANIFEST_PRIVATE_KEY;
    delete process.env.ANDROID_RELEASE_MANIFEST_KEY_ID;
  });

  afterAll(() => {
    delete process.env.ANDROID_RELEASE_MANIFEST_PRIVATE_KEY;
    delete process.env.ANDROID_RELEASE_MANIFEST_KEY_ID;
  });

  it('reports not configured when env is missing', () => {
    expect(signer.isConfigured()).toBe(false);
    expect(signer.getStatus()).toEqual(
      expect.objectContaining({ configured: false, keyId: null, signatureAlgorithm: 'Ed25519' }),
    );
    expect(() => signer.assertCanSign()).toThrow(ServiceUnavailableException);
    try {
      signer.assertCanSign();
    } catch (error) {
      expect((error as ServiceUnavailableException).getResponse()).toEqual(
        expect.objectContaining({ code: 'MANIFEST_SIGNING_NOT_CONFIGURED' }),
      );
    }
  });

  it('signs a published release and includes keyId without private material', () => {
    process.env.ANDROID_RELEASE_MANIFEST_PRIVATE_KEY = keys.privateKeyPkcs8Pem;
    process.env.ANDROID_RELEASE_MANIFEST_KEY_ID = 'rmk_test_1';
    signer.resetCacheForTests();

    expect(signer.isConfigured()).toBe(true);
    signer.assertCanSign();

    const signed = signer.signRelease({
      id: 'rel_pub_1',
      packageName: 'com.Tajroot.Ruznamo',
      versionName: '1.0.15',
      versionCode: 16,
      fileSize: BigInt(1000),
      sha256: 'ab'.repeat(32),
      mandatory: true,
      publishedAt: new Date('2026-09-04T12:00:00.000Z'),
      changelogRu: 'ru',
      changelogTg: 'tj',
    });

    expect(signed.keyId).toBe('rmk_test_1');
    expect(signed.signatureAlgorithm).toBe('Ed25519');
    expect(signed.manifest.manifestVersion).toBe(1);
    expect(signed.signature).toBeTruthy();
    expect(JSON.stringify(signed)).not.toMatch(/BEGIN PRIVATE KEY/);
    expect(signer.verifySignedManifest(signed)).toBe(true);
  });

  it('fails closed on invalid private key material', () => {
    process.env.ANDROID_RELEASE_MANIFEST_PRIVATE_KEY = 'not-a-key';
    process.env.ANDROID_RELEASE_MANIFEST_KEY_ID = 'rmk_bad';
    signer.resetCacheForTests();
    expect(signer.isConfigured()).toBe(false);
    try {
      signer.assertCanSign();
      fail('expected throw');
    } catch (error) {
      expect((error as ServiceUnavailableException).getResponse()).toEqual(
        expect.objectContaining({ code: 'MANIFEST_SIGNING_FAILED' }),
      );
    }
  });
});
