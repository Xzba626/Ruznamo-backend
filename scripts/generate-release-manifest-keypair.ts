/**
 * Owner-only helper: generate Ed25519 release-manifest keypair.
 * Does NOT upload anything. Does NOT write secrets into the repo.
 *
 * Usage:
 *   npx ts-node -P tsconfig.scripts.json scripts/generate-release-manifest-keypair.ts
 */
import { generateEphemeralEd25519KeyPair } from '../src/app-update/release-manifest/release-manifest.crypto';

const keyIdArg = process.argv.find((a) => a.startsWith('--key-id='));
const keyId = keyIdArg ? keyIdArg.slice('--key-id='.length) : 'rmk_v1';
const keys = generateEphemeralEd25519KeyPair();

process.stdout.write(`# Ruznamo release-manifest keypair (KEEP PRIVATE KEY SECRET)\n`);
process.stdout.write(`# Algorithm: Ed25519\n`);
process.stdout.write(`# Generated: ${new Date().toISOString()}\n\n`);
process.stdout.write(`ANDROID_RELEASE_MANIFEST_KEY_ID=${keyId}\n\n`);
process.stdout.write(`# Vercel backend secret (PKCS8 PEM). Do not paste into chat/Git/Android.\n`);
process.stdout.write(`ANDROID_RELEASE_MANIFEST_PRIVATE_KEY=<<PEM BELOW>>\n`);
process.stdout.write(`${keys.privateKeyPkcs8Pem}\n`);
process.stdout.write(`# Android embed only (raw 32-byte public key, hex):\n`);
process.stdout.write(`PUBLIC_KEY_RAW_HEX=${keys.publicKeyRawHex}\n\n`);
process.stdout.write(`# Optional SPKI PEM (tooling):\n`);
process.stdout.write(`${keys.publicKeySpkiPem}\n`);
process.stdout.write(`# Next: store private key in Vercel; give PUBLIC_KEY_RAW_HEX + keyId to Android Cursor.\n`);
