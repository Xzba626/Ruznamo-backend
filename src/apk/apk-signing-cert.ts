import { createHash } from 'crypto';

const APK_SIG_BLOCK_MAGIC = Buffer.from('APK Sig Block 42', 'utf8');
const APK_SIGNATURE_V2_ID = 0x7109871a;
const APK_SIGNATURE_V3_ID = 0xf05368c0;
const APK_SIGNATURE_V31_ID = 0x1b93ad61;

/**
 * Extract first signer X.509 certificate DER from APK Signature Scheme v2/v3 block.
 * Debug/release APKs may omit JAR (v1) META-INF/*.RSA and use only v2+.
 */
export function extractApkSigningBlockCertificateDer(apk: Buffer): Buffer | null {
  if (apk.length < 64) {
    return null;
  }

  const eocdOffset = findEndOfCentralDirectory(apk);
  if (eocdOffset < 0) {
    return null;
  }

  const centralDirOffset = apk.readUInt32LE(eocdOffset + 16);
  if (centralDirOffset <= 0 || centralDirOffset >= eocdOffset) {
    return null;
  }

  const signingBlock = findApkSigningBlock(apk, centralDirOffset);
  if (!signingBlock) {
    return null;
  }

  for (const blockId of [APK_SIGNATURE_V31_ID, APK_SIGNATURE_V3_ID, APK_SIGNATURE_V2_ID]) {
    const schemeBlock = findIdValuePair(signingBlock, blockId);
    if (!schemeBlock) {
      continue;
    }
    const cert = extractFirstCertificateFromSignerBlock(schemeBlock);
    if (cert) {
      return cert;
    }
  }
  return null;
}

export function sha256HexOfDerCertificate(der: Buffer): string {
  return createHash('sha256').update(der).digest('hex');
}

function findEndOfCentralDirectory(apk: Buffer): number {
  // EOCD is at the end; comment can be up to 64 KiB.
  const minOffset = Math.max(0, apk.length - 65557);
  for (let i = apk.length - 22; i >= minOffset; i -= 1) {
    if (apk.readUInt32LE(i) === 0x06054b50) {
      return i;
    }
  }
  return -1;
}

function findApkSigningBlock(
  apk: Buffer,
  centralDirOffset: number,
): Buffer | null {
  if (centralDirOffset < 32) {
    return null;
  }
  const magicOffset = centralDirOffset - 16;
  if (!apk.subarray(magicOffset, centralDirOffset).equals(APK_SIG_BLOCK_MAGIC)) {
    return null;
  }
  const blockSizeFooter = Number(apk.readBigUInt64LE(centralDirOffset - 24));
  if (!Number.isFinite(blockSizeFooter) || blockSizeFooter < 24 || blockSizeFooter > centralDirOffset) {
    return null;
  }
  const blockStart = centralDirOffset - Number(blockSizeFooter) - 8;
  if (blockStart < 0) {
    return null;
  }
  const blockSizeHeader = Number(apk.readBigUInt64LE(blockStart));
  if (blockSizeHeader !== blockSizeFooter) {
    return null;
  }
  // Pairs region: after size (8) through before size+magic (24) at end of block.
  const pairsStart = blockStart + 8;
  const pairsEnd = centralDirOffset - 24;
  if (pairsEnd <= pairsStart) {
    return null;
  }
  return apk.subarray(pairsStart, pairsEnd);
}

function findIdValuePair(pairs: Buffer, targetId: number): Buffer | null {
  let offset = 0;
  while (offset + 8 <= pairs.length) {
    const pairLen = Number(pairs.readBigUInt64LE(offset));
    offset += 8;
    if (pairLen < 4 || offset + pairLen > pairs.length) {
      return null;
    }
    const id = pairs.readUInt32LE(offset);
    const value = pairs.subarray(offset + 4, offset + pairLen);
    offset += pairLen;
    if (id === targetId) {
      return value;
    }
  }
  return null;
}

function extractFirstCertificateFromSignerBlock(schemeBlock: Buffer): Buffer | null {
  // length-prefixed sequence of length-prefixed signers
  if (schemeBlock.length < 4) {
    return null;
  }
  const signersLen = schemeBlock.readUInt32LE(0);
  if (signersLen <= 0 || 4 + signersLen > schemeBlock.length) {
    return null;
  }
  const signers = schemeBlock.subarray(4, 4 + signersLen);
  if (signers.length < 4) {
    return null;
  }
  const firstSignerLen = signers.readUInt32LE(0);
  if (firstSignerLen <= 0 || 4 + firstSignerLen > signers.length) {
    return null;
  }
  const signer = signers.subarray(4, 4 + firstSignerLen);
  if (signer.length < 4) {
    return null;
  }
  const signedDataLen = signer.readUInt32LE(0);
  if (signedDataLen <= 0 || 4 + signedDataLen > signer.length) {
    return null;
  }
  const signedData = signer.subarray(4, 4 + signedDataLen);
  // signed data: digests (u32-len) + certificates (u32-len) + additional attrs
  if (signedData.length < 4) {
    return null;
  }
  const digestsLen = signedData.readUInt32LE(0);
  let cursor = 4 + digestsLen;
  if (cursor + 4 > signedData.length) {
    return null;
  }
  const certsLen = signedData.readUInt32LE(cursor);
  cursor += 4;
  if (certsLen <= 0 || cursor + certsLen > signedData.length) {
    return null;
  }
  const certs = signedData.subarray(cursor, cursor + certsLen);
  if (certs.length < 4) {
    return null;
  }
  const firstCertLen = certs.readUInt32LE(0);
  if (firstCertLen <= 0 || 4 + firstCertLen > certs.length) {
    return null;
  }
  return certs.subarray(4, 4 + firstCertLen);
}
