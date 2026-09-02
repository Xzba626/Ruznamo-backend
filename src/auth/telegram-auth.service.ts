import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditActorType, TelegramAuthPurpose } from '@prisma/client';
import { createHash, randomInt, timingSafeEqual } from 'crypto';
import { AuditService } from '../audit/audit.service';
import { MobileJwtPayload } from './mobile-jwt.payload';
import { PrismaService } from '../prisma/prisma.service';
import { TokenHashService } from '../security/token-hash.service';
import { buildAuthStartPayload } from '../licenses/license-link-token.util';

const CHALLENGE_TTL_MS = 15 * 60 * 1000;
const OTP_TTL_MS = 5 * 60 * 1000;
const GRANT_TTL_MS = 10 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;
const OTP_DIGITS = 6;

export interface RecoveryGrantContext {
  grantId: string;
  challengeId: string;
  telegramAccountId: string;
  deviceId: string;
  mobileUserId: string;
  purpose: TelegramAuthPurpose;
  expiresAt: Date;
}

@Injectable()
export class TelegramAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly tokenHashService: TokenHashService,
    private readonly auditService: AuditService,
  ) {}

  async createChallenge(user: MobileJwtPayload, purpose: TelegramAuthPurpose) {
    if (!user.deviceId) {
      throw new ForbiddenException({ code: 'DEVICE_REQUIRED', message: 'Active device session required' });
    }

    const device = await this.prisma.deviceInstallation.findFirst({
      where: { id: user.deviceId, userId: user.sub, revokedAt: null },
    });
    if (!device) {
      throw new ForbiddenException({ code: 'DEVICE_REVOKED', message: 'Current device is not active' });
    }

    const opaqueToken = this.tokenHashService.generateOpaqueToken();
    const tokenHash = this.tokenHashService.hashToken(opaqueToken);
    const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS);

    const challenge = await this.prisma.telegramAuthChallenge.create({
      data: {
        tokenHash,
        requestingDeviceId: device.id,
        requestingMobileUserId: user.sub,
        purpose,
        maxAttempts: MAX_OTP_ATTEMPTS,
        expiresAt,
      },
    });

    await this.auditService.log({
      actorType: AuditActorType.USER,
      actorId: user.sub,
      action: 'auth.telegram.challenge_created',
      entityType: 'TelegramAuthChallenge',
      entityId: challenge.id,
      metadata: { purpose, deviceId: device.id },
    });

    const botUsername = this.configService.get<string>('telegram.botUsername', 'Ruznamo_bot');
    const startPayload = buildAuthStartPayload(opaqueToken);

    return {
      challengeId: challenge.id,
      expiresAt,
      deepLink: `https://t.me/${botUsername.replace(/^@/, '')}?start=${startPayload}`,
    };
  }

  async bindTelegramAndIssueOtp(
    opaqueToken: string,
    telegramAccountId: string,
    actorTelegramUserId: bigint,
    deliverOtp: (code: string) => Promise<void>,
  ): Promise<void> {
    const tokenHash = this.tokenHashService.hashToken(opaqueToken);
    const challenge = await this.prisma.telegramAuthChallenge.findUnique({
      where: { tokenHash },
    });

    if (!challenge) {
      throw new NotFoundException({
        code: 'AUTH_CHALLENGE_INVALID',
        message: 'Auth link not found or expired',
      });
    }

    if (challenge.consumedAt) {
      throw new BadRequestException({
        code: 'AUTH_CHALLENGE_USED',
        message: 'This link has already been used or expired',
      });
    }

    if (challenge.expiresAt <= new Date()) {
      throw new BadRequestException({
        code: 'AUTH_CHALLENGE_EXPIRED',
        message: 'This link has already been used or expired',
      });
    }

    const telegramAccount = await this.prisma.telegramAccount.findUnique({
      where: { id: telegramAccountId },
    });

    if (!telegramAccount || telegramAccount.telegramId !== actorTelegramUserId) {
      throw new ForbiddenException({
        code: 'TELEGRAM_IDENTITY_MISMATCH',
        message: 'Telegram sender does not match resolved account',
      });
    }

    if (
      challenge.telegramAccountId &&
      challenge.telegramAccountId !== telegramAccountId
    ) {
      throw new BadRequestException({
        code: 'AUTH_CHALLENGE_BOUND',
        message: 'This auth link was already opened from another Telegram account',
      });
    }

    const otp = this.generateOtp();
    const otpHash = this.hashOtp(otp);
    const otpExpiresAt = new Date(Date.now() + OTP_TTL_MS);

    await this.prisma.telegramAuthChallenge.update({
      where: { id: challenge.id },
      data: {
        telegramAccountId: telegramAccountId,
        otpHash,
        otpExpiresAt,
        attemptCount: 0,
      },
    });

    await this.auditService.log({
      actorType: AuditActorType.TELEGRAM_BOT,
      actorId: telegramAccountId,
      action: 'auth.telegram.otp_issued',
      entityType: 'TelegramAuthChallenge',
      entityId: challenge.id,
      metadata: { purpose: challenge.purpose },
    });

    await deliverOtp(otp);
  }

  async verifyOtp(challengeId: string, code: string, user: MobileJwtPayload) {
    if (!user.deviceId) {
      throw new ForbiddenException({ code: 'DEVICE_REQUIRED', message: 'Active device session required' });
    }

    const challenge = await this.prisma.telegramAuthChallenge.findUnique({
      where: { id: challengeId },
      include: { telegramAccount: { select: { id: true, username: true, firstName: true } } },
    });

    if (!challenge) {
      throw new NotFoundException({ code: 'AUTH_CHALLENGE_INVALID', message: 'Challenge not found' });
    }

    if (challenge.requestingMobileUserId !== user.sub || challenge.requestingDeviceId !== user.deviceId) {
      throw new ForbiddenException({
        code: 'AUTH_CHALLENGE_DEVICE_MISMATCH',
        message: 'Challenge does not belong to this device session',
      });
    }

    if (challenge.consumedAt) {
      throw new BadRequestException({
        code: 'AUTH_CHALLENGE_USED',
        message: 'Challenge already completed',
      });
    }

    if (challenge.expiresAt <= new Date()) {
      throw new BadRequestException({ code: 'AUTH_CHALLENGE_EXPIRED', message: 'Challenge expired' });
    }

    if (!challenge.telegramAccountId || !challenge.otpHash || !challenge.otpExpiresAt) {
      throw new BadRequestException({
        code: 'AUTH_TELEGRAM_PENDING',
        message: 'Open the Telegram link first to receive a confirmation code',
      });
    }

    if (challenge.attemptCount >= challenge.maxAttempts) {
      throw new ForbiddenException({
        code: 'AUTH_OTP_LOCKED',
        message: 'Too many incorrect attempts; start a new verification',
      });
    }

    if (challenge.otpExpiresAt <= new Date()) {
      throw new BadRequestException({ code: 'AUTH_OTP_EXPIRED', message: 'Confirmation code expired' });
    }

    const normalizedCode = code.replace(/\s+/g, '').trim();
    const otpValid = this.verifyOtpHash(normalizedCode, challenge.otpHash);

    if (!otpValid) {
      const nextAttempts = challenge.attemptCount + 1;
      await this.prisma.telegramAuthChallenge.update({
        where: { id: challenge.id },
        data: { attemptCount: nextAttempts },
      });

      if (nextAttempts >= challenge.maxAttempts) {
        await this.prisma.telegramAuthChallenge.update({
          where: { id: challenge.id },
          data: { consumedAt: new Date() },
        });
        throw new ForbiddenException({
          code: 'AUTH_OTP_LOCKED',
          message: 'Too many incorrect attempts; start a new verification',
        });
      }

      throw new BadRequestException({
        code: 'AUTH_OTP_INVALID',
        message: 'Incorrect confirmation code',
      });
    }

    const now = new Date();
    const grantExpiresAt = new Date(Date.now() + GRANT_TTL_MS);

    const grant = await this.prisma.$transaction(async (tx) => {
      await tx.telegramAuthChallenge.update({
        where: { id: challenge.id },
        data: {
          verifiedAt: now,
          consumedAt: now,
          otpHash: null,
          otpExpiresAt: null,
        },
      });

      return tx.telegramRecoveryGrant.create({
        data: {
          challengeId: challenge.id,
          telegramAccountId: challenge.telegramAccountId!,
          deviceId: challenge.requestingDeviceId,
          mobileUserId: challenge.requestingMobileUserId,
          expiresAt: grantExpiresAt,
        },
      });
    });

    await this.auditService.log({
      actorType: AuditActorType.USER,
      actorId: user.sub,
      action: 'auth.telegram.verified',
      entityType: 'TelegramRecoveryGrant',
      entityId: grant.id,
      metadata: {
        challengeId: challenge.id,
        telegramAccountId: challenge.telegramAccountId,
        purpose: challenge.purpose,
      },
    });

    const holder = challenge.telegramAccount;

    return {
      recoveryGrantId: grant.id,
      expiresAt: grantExpiresAt,
      purpose: challenge.purpose,
      holderDisplayName: holder?.firstName ?? null,
      holderUsername: holder?.username ? `@${holder.username.replace(/^@/, '')}` : null,
    };
  }

  async assertValidGrant(
    recoveryGrantId: string,
    user: MobileJwtPayload,
  ): Promise<RecoveryGrantContext> {
    if (!user.deviceId) {
      throw new ForbiddenException({ code: 'DEVICE_REQUIRED', message: 'Active device session required' });
    }

    const grant = await this.prisma.telegramRecoveryGrant.findUnique({
      where: { id: recoveryGrantId },
      include: { challenge: { select: { purpose: true } } },
    });

    if (!grant) {
      throw new NotFoundException({ code: 'RECOVERY_GRANT_INVALID', message: 'Recovery session not found' });
    }

    if (grant.mobileUserId !== user.sub || grant.deviceId !== user.deviceId) {
      throw new ForbiddenException({
        code: 'RECOVERY_GRANT_DEVICE_MISMATCH',
        message: 'Recovery session does not belong to this device',
      });
    }

    if (grant.consumedAt) {
      throw new BadRequestException({
        code: 'RECOVERY_GRANT_USED',
        message: 'Recovery session already completed',
      });
    }

    if (grant.expiresAt <= new Date()) {
      throw new BadRequestException({ code: 'RECOVERY_GRANT_EXPIRED', message: 'Recovery session expired' });
    }

    return {
      grantId: grant.id,
      challengeId: grant.challengeId,
      telegramAccountId: grant.telegramAccountId,
      deviceId: grant.deviceId,
      mobileUserId: grant.mobileUserId,
      purpose: grant.challenge.purpose,
      expiresAt: grant.expiresAt,
    };
  }

  async consumeGrant(recoveryGrantId: string): Promise<void> {
    await this.prisma.telegramRecoveryGrant.update({
      where: { id: recoveryGrantId },
      data: { consumedAt: new Date() },
    });
  }

  private generateOtp(): string {
    const max = 10 ** OTP_DIGITS;
    const value = randomInt(0, max);
    return value.toString().padStart(OTP_DIGITS, '0');
  }

  private hashOtp(code: string): string {
    return createHash('sha256').update(`ruznamo-otp:${code}`).digest('hex');
  }

  private verifyOtpHash(code: string, hash: string): boolean {
    const computed = this.hashOtp(code);
    if (computed.length !== hash.length) {
      return false;
    }
    return timingSafeEqual(Buffer.from(computed), Buffer.from(hash));
  }
}
