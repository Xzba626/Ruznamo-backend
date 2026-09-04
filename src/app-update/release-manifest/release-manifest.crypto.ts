import {
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  sign as cryptoSign,
  verify as cryptoVerify,
  type KeyObject,
} from 'crypto';
import { RELEASE_MANIFEST_SIGNATURE_ALGORITHM } from './release-manifest.types';

/** Standard base64url without padding. */
export function toBase64Url(buf: Buffer): string {
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

export function fromBase64Url(value: string): Buffer {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (padded.length % 4)) % 4;
  return Buffer.from(padded + '='.repeat(padLen), 'base64');
}

export function parsePkcs8PrivateKey(raw: string): KeyObject {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error('Empty manifest private key');
  }
  if (trimmed.includes('BEGIN PRIVATE KEY')) {
    return createPrivateKey(trimmed);
  }
  // Accept base64 (standard) of PKCS8 DER
  const der = Buffer.from(trimmed.replace(/\s+/g, ''), 'base64');
  return createPrivateKey({ key: der, format: 'der', type: 'pkcs8' });
}

export function derivePublicKey(privateKey: KeyObject): KeyObject {
  return createPublicKey(privateKey);
}

/** Raw 32-byte Ed25519 public key as lowercase hex (Android embedding format). */
export function exportRawPublicKeyHex(publicKey: KeyObject): string {
  const spki = publicKey.export({ type: 'spki', format: 'der' }) as Buffer;
  // SPKI for Ed25519 is 12-byte header + 32-byte key
  if (spki.length < 32) {
    throw new Error('Unexpected Ed25519 SPKI length');
  }
  return spki.subarray(spki.length - 32).toString('hex');
}

export function exportSpkiPem(publicKey: KeyObject): string {
  return publicKey.export({ type: 'spki', format: 'pem' }).toString();
}

export function signUtf8Payload(privateKey: KeyObject, signedPayload: string): Buffer {
  return cryptoSign(null, Buffer.from(signedPayload, 'utf8'), privateKey);
}

export function verifyUtf8Payload(
  publicKey: KeyObject,
  signedPayload: string,
  signature: Buffer,
): boolean {
  return cryptoVerify(null, Buffer.from(signedPayload, 'utf8'), publicKey, signature);
}

export function generateEphemeralEd25519KeyPair(): {
  privateKey: KeyObject;
  publicKey: KeyObject;
  privateKeyPkcs8Pem: string;
  publicKeySpkiPem: string;
  publicKeyRawHex: string;
} {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  return {
    privateKey,
    publicKey,
    privateKeyPkcs8Pem: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    publicKeySpkiPem: exportSpkiPem(publicKey),
    publicKeyRawHex: exportRawPublicKeyHex(publicKey),
  };
}

export function assertEd25519Algorithm(): typeof RELEASE_MANIFEST_SIGNATURE_ALGORITHM {
  return RELEASE_MANIFEST_SIGNATURE_ALGORITHM;
}
