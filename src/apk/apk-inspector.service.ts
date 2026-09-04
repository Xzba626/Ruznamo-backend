import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import AdmZipImport from 'adm-zip';
import AppInfoParserImport from 'app-info-parser';
import { createHash } from 'crypto';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  extractApkSigningBlockCertificateDer,
  sha256HexOfDerCertificate,
} from './apk-signing-cert';

/** CJS packages may expose constructor on module or `.default` after Nest/Vercel bundling. */
function resolveCjsConstructor<T>(mod: T | { default: T }): T {
  if (mod && typeof (mod as { default?: unknown }).default === 'function') {
    return (mod as { default: T }).default;
  }
  return mod as T;
}

const AdmZip = resolveCjsConstructor(AdmZipImport);
const AppInfoParser = resolveCjsConstructor(AppInfoParserImport);

export interface ApkInspectionResult {
  packageName: string;
  versionName: string;
  versionCode: number;
  sha256: string;
  fileSize: number;
  signingCertificateSha256: string;
}

@Injectable()
export class ApkInspectorService {
  constructor(private readonly configService: ConfigService) {}

  async inspect(buffer: Buffer): Promise<ApkInspectionResult> {
    if (buffer.length < 1024) {
      throw new BadRequestException({ code: 'INVALID_APK', message: 'APK file is too small' });
    }

    const sha256 = createHash('sha256').update(buffer).digest('hex');
    const signingCertificateSha256 = this.extractSigningCertificateSha256(buffer);

    const tempDir = await mkdtemp(join(tmpdir(), 'ruznamo-apk-'));
    const tempPath = join(tempDir, 'upload.apk');

    try {
      await writeFile(tempPath, buffer);
      return this.inspectParsed(tempPath, {
        sha256,
        fileSize: buffer.length,
        signingCertificateSha256,
      });
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }

  /** Inspect APK already on disk (Blob finalize path). */
  async inspectFile(filePath: string, fileSize: number): Promise<ApkInspectionResult> {
    const { createReadStream } = await import('fs');
    const hash = createHash('sha256');
    await new Promise<void>((resolve, reject) => {
      const stream = createReadStream(filePath);
      stream.on('data', (chunk) => hash.update(chunk));
      stream.on('error', reject);
      stream.on('end', () => resolve());
    });
    const sha256 = hash.digest('hex');
    const { readFile } = await import('fs/promises');
    const bufferForSig = await readFile(filePath);
    const signingCertificateSha256 = this.extractSigningCertificateSha256(bufferForSig);
    return this.inspectParsed(filePath, {
      sha256,
      fileSize,
      signingCertificateSha256,
    });
  }

  private async inspectParsed(
    tempPath: string,
    base: { sha256: string; fileSize: number; signingCertificateSha256: string },
  ): Promise<ApkInspectionResult> {
    const parser = new AppInfoParser(tempPath);
    const info = (await parser.parse()) as {
      package?: string;
      versionName?: string;
      versionCode?: number | string;
    };

    const packageName = info.package?.trim();
    const versionName = info.versionName?.trim();
    const versionCode = Number(info.versionCode);

    if (!packageName || !versionName || !Number.isFinite(versionCode) || versionCode <= 0) {
      throw new BadRequestException({
        code: 'INVALID_APK_METADATA',
        message: 'Could not parse APK package/version metadata',
      });
    }

    const expectedPackage = this.configService.get<string>(
      'storage.expectedPackageName',
      'com.Tajroot.Ruznamo',
    );
    if (packageName !== expectedPackage) {
      throw new BadRequestException({
        code: 'APK_PACKAGE_MISMATCH',
        message: `Expected package ${expectedPackage}, got ${packageName}`,
      });
    }

    const allowedCert = this.configService
      .get<string>('storage.allowedSigningCertSha256')
      ?.toLowerCase();
    if (allowedCert && base.signingCertificateSha256 !== allowedCert) {
      throw new BadRequestException({
        code: 'APK_SIGNING_MISMATCH',
        message: 'APK signing certificate does not match configured release identity',
      });
    }

    return {
      packageName,
      versionName,
      versionCode,
      sha256: base.sha256,
      fileSize: base.fileSize,
      signingCertificateSha256: base.signingCertificateSha256,
    };
  }

  private extractSigningCertificateSha256(buffer: Buffer): string {
    // Prefer JAR (v1) certificate when present.
    const zip = new AdmZip(buffer);
    const certEntry = zip
      .getEntries()
      .find((entry) => /^META-INF\/.*\.(RSA|DSA|EC)$/i.test(entry.entryName));
    if (certEntry) {
      return createHash('sha256').update(certEntry.getData()).digest('hex');
    }

    // Modern debug/release APKs often use only APK Signature Scheme v2/v3.
    const der = extractApkSigningBlockCertificateDer(buffer);
    if (der) {
      return sha256HexOfDerCertificate(der);
    }

    throw new BadRequestException({
      code: 'APK_SIGNATURE_MISSING',
      message: 'Could not locate APK signing certificate (v1/v2/v3)',
    });
  }
}
