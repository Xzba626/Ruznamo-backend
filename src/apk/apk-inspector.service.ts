import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import AdmZip from 'adm-zip';
import AppInfoParser from 'app-info-parser';
import { createHash } from 'crypto';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

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
      if (allowedCert && signingCertificateSha256 !== allowedCert) {
        throw new BadRequestException({
          code: 'APK_SIGNING_MISMATCH',
          message: 'APK signing certificate does not match configured release identity',
        });
      }

      return {
        packageName,
        versionName,
        versionCode,
        sha256,
        fileSize: buffer.length,
        signingCertificateSha256,
      };
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }

  private extractSigningCertificateSha256(buffer: Buffer): string {
    const zip = new AdmZip(buffer);
    const certEntry = zip
      .getEntries()
      .find((entry) => /^META-INF\/.*\.(RSA|DSA|EC)$/i.test(entry.entryName));

    if (!certEntry) {
      throw new BadRequestException({
        code: 'APK_SIGNATURE_MISSING',
        message: 'Could not locate APK signing certificate',
      });
    }

    const certBuffer = certEntry.getData();
    return createHash('sha256').update(certBuffer).digest('hex');
  }
}
