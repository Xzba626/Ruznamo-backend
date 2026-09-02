import { Injectable } from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';

const WEAK_PASSWORDS = new Set(['1234', '0000', 'admin', 'password', '12345678']);

@Injectable()
export class ResetPasswordService {
  async hash(plain: string): Promise<string> {
    this.assertStrongEnough(plain);
    return hash(plain, {
      memoryCost: 19456,
      timeCost: 2,
      outputLen: 32,
      parallelism: 1,
    });
  }

  async verify(plain: string, storedHash: string): Promise<boolean> {
    try {
      return await verify(storedHash, plain);
    } catch {
      return false;
    }
  }

  assertStrongEnough(plain: string): void {
    const normalized = plain.trim().toLowerCase();
    if (plain.length < 12) {
      throw new Error('RESET_PASSWORD_TOO_SHORT');
    }
    if (WEAK_PASSWORDS.has(normalized)) {
      throw new Error('RESET_PASSWORD_TOO_WEAK');
    }
  }
}
