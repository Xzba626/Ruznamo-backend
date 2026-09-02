import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';

@Injectable()
export class ObjectStorageService {
  private readonly client: S3Client | null;
  private readonly bucket: string | undefined;
  private readonly publicBaseUrl: string | undefined;
  private readonly apkPrefix: string;

  constructor(private readonly configService: ConfigService) {
    const endpoint = this.configService.get<string>('storage.endpoint');
    const region = this.configService.get<string>('storage.region', 'auto');
    const accessKeyId = this.configService.get<string>('storage.accessKeyId');
    const secretAccessKey = this.configService.get<string>('storage.secretAccessKey');

    this.bucket = this.configService.get<string>('storage.bucket');
    this.publicBaseUrl = this.configService.get<string>('storage.publicBaseUrl');
    this.apkPrefix = this.configService.get<string>('storage.apkPrefix', 'releases/android');

    if (endpoint && this.bucket && accessKeyId && secretAccessKey) {
      this.client = new S3Client({
        region,
        endpoint,
        credentials: { accessKeyId, secretAccessKey },
        forcePathStyle: true,
      });
    } else {
      this.client = null;
    }
  }

  isConfigured(): boolean {
    return Boolean(this.client && this.bucket);
  }

  buildApkObjectKey(versionCode: number, sha256: string): string {
    const safeHash = sha256.slice(0, 16);
    return `${this.apkPrefix}/ruznamo-${versionCode}-${safeHash}.apk`;
  }

  async putObject(key: string, body: Buffer, contentType: string): Promise<void> {
    this.assertConfigured();
    await this.client!.send(
      new PutObjectCommand({
        Bucket: this.bucket!,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  async headObject(key: string): Promise<{ size: number; exists: boolean }> {
    this.assertConfigured();
    try {
      const result = await this.client!.send(
        new HeadObjectCommand({ Bucket: this.bucket!, Key: key }),
      );
      return { size: Number(result.ContentLength ?? 0), exists: true };
    } catch {
      return { size: 0, exists: false };
    }
  }

  async getObjectStream(key: string): Promise<Readable> {
    this.assertConfigured();
    const result = await this.client!.send(
      new GetObjectCommand({ Bucket: this.bucket!, Key: key }),
    );
    if (!result.Body) {
      throw new ServiceUnavailableException('STORAGE_OBJECT_NOT_FOUND');
    }
    return result.Body as Readable;
  }

  async deleteObject(key: string): Promise<void> {
    this.assertConfigured();
    await this.client!.send(
      new DeleteObjectCommand({ Bucket: this.bucket!, Key: key }),
    );
  }

  async getSignedDownloadUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    this.assertConfigured();
    const command = new GetObjectCommand({ Bucket: this.bucket!, Key: key });
    return getSignedUrl(this.client!, command, { expiresIn: expiresInSeconds });
  }

  getPublicUrl(key: string): string | null {
    if (!this.publicBaseUrl) {
      return null;
    }
    return `${this.publicBaseUrl.replace(/\/$/, '')}/${key}`;
  }

  private assertConfigured(): void {
    if (!this.client || !this.bucket) {
      throw new ServiceUnavailableException({
        code: 'OBJECT_STORAGE_NOT_CONFIGURED',
        message: 'Object storage is not configured',
      });
    }
  }
}
