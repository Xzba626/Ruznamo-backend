import {
  buildManifestPayload,
  buildSignedPayload,
  serializeCanonicalManifestJson,
} from './release-manifest.canonical';
import {
  fromBase64Url,
  generateEphemeralEd25519KeyPair,
  signUtf8Payload,
  toBase64Url,
  verifyUtf8Payload,
} from './release-manifest.crypto';
import { RELEASE_MANIFEST_DOMAIN, RELEASE_MANIFEST_VERSION } from './release-manifest.types';
import { createPublicKey } from 'crypto';

function publicKeyFromRawHex(hex: string) {
  // Ed25519 SPKI DER prefix (RFC 8410) + raw 32-byte key
  const prefix = Buffer.from('302a300506032b6570032100', 'hex');
  const raw = Buffer.from(hex, 'hex');
  return createPublicKey({ key: Buffer.concat([prefix, raw]), format: 'der', type: 'spki' });
}

describe('release manifest canonicalization + Ed25519', () => {
  const fixture = buildManifestPayload({
    releaseId: 'clxxxxxxxxxxxxxxxxxxxx',
    packageName: 'com.Tajroot.Ruznamo',
    versionName: '1.0.15',
    versionCode: 16,
    fileSize: 26323888,
    sha256: 'eef66d94c7a6338582142571533d2f9137298450d98a34dbd4bb16ea546aac04',
    mandatory: false,
    publishedAt: '2026-09-04T10:00:00.000Z',
    changelogRu: 'Исправления',
    changelogTg: 'Ислоҳот',
  });

  it('serializes deterministically with fixed key order', () => {
    const a = serializeCanonicalManifestJson(fixture);
    const b = serializeCanonicalManifestJson({ ...fixture });
    expect(a).toBe(b);
    expect(a.startsWith('{"manifestVersion":1,')).toBe(true);
    expect(a).toContain('"releaseId":"clxxxxxxxxxxxxxxxxxxxx"');
    expect(a).toContain('"versionCode":16');
    expect(a).toContain('"mandatory":false');
  });

  it('domain-separates the signed payload', () => {
    const payload = buildSignedPayload(fixture);
    expect(payload.startsWith(`${RELEASE_MANIFEST_DOMAIN}\n`)).toBe(true);
    expect(payload.split('\n')[1]).toBe(serializeCanonicalManifestJson(fixture));
  });

  it('signs and verifies with Ed25519 (PASS vector)', () => {
    const keys = generateEphemeralEd25519KeyPair();
    const signedPayload = buildSignedPayload(fixture);
    const signature = signUtf8Payload(keys.privateKey, signedPayload);
    expect(verifyUtf8Payload(keys.publicKey, signedPayload, signature)).toBe(true);
    expect(verifyUtf8Payload(publicKeyFromRawHex(keys.publicKeyRawHex), signedPayload, signature)).toBe(
      true,
    );
    expect(toBase64Url(signature)).not.toContain('+');
    expect(toBase64Url(signature)).not.toContain('/');
  });

  it('fails when 1 byte of manifest changes', () => {
    const keys = generateEphemeralEd25519KeyPair();
    const signedPayload = buildSignedPayload(fixture);
    const signature = signUtf8Payload(keys.privateKey, signedPayload);
    const tampered = buildSignedPayload({ ...fixture, versionName: '1.0.16' });
    expect(verifyUtf8Payload(keys.publicKey, tampered, signature)).toBe(false);
  });

  it('fails when sha256 changes', () => {
    const keys = generateEphemeralEd25519KeyPair();
    const signedPayload = buildSignedPayload(fixture);
    const signature = signUtf8Payload(keys.privateKey, signedPayload);
    const tampered = buildSignedPayload({
      ...fixture,
      sha256: 'ff'.repeat(32),
    });
    expect(verifyUtf8Payload(keys.publicKey, tampered, signature)).toBe(false);
  });

  it('fails when versionCode changes', () => {
    const keys = generateEphemeralEd25519KeyPair();
    const signedPayload = buildSignedPayload(fixture);
    const signature = signUtf8Payload(keys.privateKey, signedPayload);
    const tampered = buildSignedPayload({ ...fixture, versionCode: 99 });
    expect(verifyUtf8Payload(keys.publicKey, tampered, signature)).toBe(false);
  });

  it('fails with wrong public key', () => {
    const a = generateEphemeralEd25519KeyPair();
    const b = generateEphemeralEd25519KeyPair();
    const signedPayload = buildSignedPayload(fixture);
    const signature = signUtf8Payload(a.privateKey, signedPayload);
    expect(verifyUtf8Payload(b.publicKey, signedPayload, signature)).toBe(false);
  });

  it('fails when signature bytes change', () => {
    const keys = generateEphemeralEd25519KeyPair();
    const signedPayload = buildSignedPayload(fixture);
    const signature = Buffer.from(signUtf8Payload(keys.privateKey, signedPayload));
    signature[0] ^= 0xff;
    expect(verifyUtf8Payload(keys.publicKey, signedPayload, signature)).toBe(false);
  });

  it('rejects unknown manifestVersion at serialize time', () => {
    expect(() =>
      serializeCanonicalManifestJson({
        ...fixture,
        manifestVersion: 2 as typeof RELEASE_MANIFEST_VERSION,
      }),
    ).toThrow(/Unsupported manifestVersion/);
  });

  it('round-trips base64url signature encoding', () => {
    const keys = generateEphemeralEd25519KeyPair();
    const signedPayload = buildSignedPayload(fixture);
    const signature = signUtf8Payload(keys.privateKey, signedPayload);
    const encoded = toBase64Url(signature);
    expect(fromBase64Url(encoded).equals(signature)).toBe(true);
  });
});
