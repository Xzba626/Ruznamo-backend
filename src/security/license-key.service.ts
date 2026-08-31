import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';

@Injectable()
export class LicenseKeyService {
  constructor(private readonly configService: ConfigService) {}

  normalizeKey(licenseKey: string): string {
    return licenseKey.trim().toUpperCase().replace(/\s+/g, '');
  }

  hashKey(normalizedKey: string): string {
    const pepper = this.configService.get<string>('security.licenseKeyPepper');
    if (!pepper) {
      throw new Error('LICENSE_KEY_PEPPER is not configured');
    }

    return createHmac('sha256', pepper).update(normalizedKey).digest('hex');
  }

  prefix(normalizedKey: string, length = 8): string {
    return normalizedKey.slice(0, length);
  }
}
