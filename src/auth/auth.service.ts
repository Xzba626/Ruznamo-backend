import {
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  AuditActorType,
  Platform,
  TrialGrantStatus,
  UserCategory,
  UserStatus,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { buildDeviceMetadataUpdate } from '../devices/device-metadata.util';
import { DeviceTelemetryService } from '../devices/device-telemetry.service';
import { TokenHashService } from '../security/token-hash.service';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { MobileJwtPayload } from './mobile-jwt.payload';

export interface MobileAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenHashService: TokenHashService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
    private readonly deviceTelemetry: DeviceTelemetryService,
  ) {}

  async registerDevice(dto: RegisterDeviceDto, meta: RequestMeta) {
    const maintenance = await this.prisma.systemConfig.findUnique({
      where: { key: 'MAINTENANCE_MODE' },
    });
    if (maintenance?.value === 'true') {
      throw new ServiceUnavailableException({
        code: 'MAINTENANCE_MODE',
        message: 'Service is temporarily unavailable',
      });
    }

    const existing = await this.prisma.deviceInstallation.findUnique({
      where: { installationId: dto.installationId },
      include: { user: { include: { trialGrant: true } } },
    });

    if (existing) {
      if (existing.user.status === UserStatus.SUSPENDED) {
        throw new ForbiddenException({
          code: 'USER_SUSPENDED',
          message: 'Account is suspended',
        });
      }

      if (existing.user.status === UserStatus.DELETED) {
        throw new ForbiddenException({
          code: 'USER_DELETED',
          message: 'Account is not available',
        });
      }

      const metadata = buildDeviceMetadataUpdate(dto);
      const device = await this.prisma.deviceInstallation.update({
        where: { id: existing.id },
        data: {
          ...metadata,
          deviceName: dto.deviceName ?? metadata.deviceName,
          platform: dto.platform,
          lastSeenAt: new Date(),
          lastSeenIp: meta.ipAddress,
        },
      });

      const tokens = await this.issueTokenPair(
        existing.userId,
        device.id,
        dto.installationId,
        meta,
      );

      await this.auditService.log({
        actorType: AuditActorType.USER,
        actorId: existing.userId,
        action: existing.revokedAt ? 'mobile.login_revoked_device' : 'mobile.login',
        entityType: 'DeviceInstallation',
        entityId: device.id,
        metadata: { installationId: dto.installationId, returning: true, revoked: Boolean(existing.revokedAt) },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });

      return this.buildRegisterResponse(existing.user, device, existing.user.trialGrant, tokens);
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          category: dto.category ?? UserCategory.PERSONAL,
          status: UserStatus.ACTIVE,
        },
      });

      const metadata = buildDeviceMetadataUpdate(dto);
      const device = await tx.deviceInstallation.create({
        data: {
          userId: user.id,
          installationId: dto.installationId,
          platform: dto.platform ?? Platform.ANDROID,
          ...metadata,
          deviceName: dto.deviceName ?? metadata.deviceName,
          deviceManufacturer: dto.deviceManufacturer,
          deviceModel: dto.deviceModel,
          androidOsVersion: dto.androidOsVersion,
          registrationIp: meta.ipAddress,
          lastSeenIp: meta.ipAddress,
          lastSeenAt: new Date(),
        },
      });

      const trialHours = await this.getTrialDurationHours(tx);
      const trial = await tx.trialGrant.create({
        data: {
          userId: user.id,
          installationId: dto.installationId,
          status: TrialGrantStatus.ACTIVE,
          expiresAt: new Date(Date.now() + trialHours * 3600 * 1000),
        },
      });

      return { user, device, trial };
    });

    const tokens = await this.issueTokenPair(
      result.user.id,
      result.device.id,
      dto.installationId,
      meta,
    );

    await this.auditService.log({
      actorType: AuditActorType.USER,
      actorId: result.user.id,
      action: 'user.registered',
      entityType: 'User',
      entityId: result.user.id,
      metadata: { installationId: dto.installationId },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    await this.auditService.log({
      actorType: AuditActorType.USER,
      actorId: result.user.id,
      action: 'device.registered',
      entityType: 'DeviceInstallation',
      entityId: result.device.id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    await this.auditService.log({
      actorType: AuditActorType.SYSTEM,
      actorId: result.user.id,
      action: 'trial.granted',
      entityType: 'TrialGrant',
      entityId: result.trial.id,
      metadata: { expiresAt: result.trial.expiresAt.toISOString() },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return this.buildRegisterResponse(result.user, result.device, result.trial, tokens);
  }

  async refresh(refreshToken: string, meta: RequestMeta, telemetry?: {
    appVersion?: string;
    appVersionName?: string;
    appVersionCode?: number;
    appLocale?: string;
    deviceManufacturer?: string;
    deviceModel?: string;
    androidOsVersion?: string;
  }): Promise<MobileAuthTokens> {
    const tokenHash = this.tokenHashService.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: {
        user: true,
        device: true,
      },
    });

    if (!stored || stored.revokedAt) {
      throw new UnauthorizedException({
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Invalid or expired refresh token',
      });
    }

    if (stored.expiresAt < new Date()) {
      throw new UnauthorizedException({
        code: 'REFRESH_TOKEN_EXPIRED',
        message: 'Refresh token has expired',
      });
    }

    if (stored.user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException({
        code: 'USER_SUSPENDED',
        message: 'Account is not active',
      });
    }

    const device = stored.device;
    if (!device) {
      throw new ForbiddenException({
        code: 'DEVICE_REVOKED',
        message: 'No active device found for this session',
      });
    }

    if (telemetry) {
      await this.deviceTelemetry.syncByInstallationId(device.installationId, telemetry, meta.ipAddress);
    } else {
      await this.deviceTelemetry.touchLastSeen(device.id, meta.ipAddress);
    }

    const tokens = await this.issueTokenPair(
      stored.userId,
      device.id,
      device.installationId,
      meta,
      stored.id,
    );

    await this.auditService.log({
      actorType: AuditActorType.USER,
      actorId: stored.userId,
      action: 'mobile.refresh',
      entityType: 'RefreshToken',
      entityId: stored.id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return tokens;
  }

  async logout(userId: string, refreshToken: string | undefined, meta: RequestMeta): Promise<void> {
    if (refreshToken) {
      const tokenHash = this.tokenHashService.hashToken(refreshToken);
      await this.prisma.refreshToken.updateMany({
        where: { userId, tokenHash, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    await this.auditService.log({
      actorType: AuditActorType.USER,
      actorId: userId,
      action: 'mobile.logout',
      entityType: 'User',
      entityId: userId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
  }

  async logoutAll(userId: string, meta: RequestMeta): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await this.auditService.log({
      actorType: AuditActorType.USER,
      actorId: userId,
      action: 'mobile.logout_all',
      entityType: 'User',
      entityId: userId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
  }

  private async issueTokenPair(
    userId: string,
    deviceId: string,
    installationId: string,
    meta: RequestMeta,
    replaceTokenId?: string,
  ): Promise<MobileAuthTokens> {
    const accessExpiresIn = this.parseExpiresInSeconds(
      this.configService.get<string>('jwt.accessExpiresIn', '15m'),
    );
    const refreshExpiresIn = this.parseExpiresInSeconds(
      this.configService.get<string>('jwt.refreshExpiresIn', '30d'),
    );
    const audience = this.configService.get<string>('jwt.accessAudience', 'ruznamo-mobile');

    const payload: Omit<MobileJwtPayload, 'aud'> = {
      sub: userId,
      deviceId,
      installationId,
      type: 'access',
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('jwt.accessSecret'),
      expiresIn: accessExpiresIn,
      audience,
    });

    const refreshToken = this.tokenHashService.generateOpaqueToken();
    const tokenHash = this.tokenHashService.hashToken(refreshToken);

    const created = await this.prisma.refreshToken.create({
      data: {
        userId,
        deviceId,
        tokenHash,
        expiresAt: new Date(Date.now() + refreshExpiresIn * 1000),
        userAgent: meta.userAgent,
        ipAddress: meta.ipAddress,
      },
    });

    if (replaceTokenId) {
      await this.prisma.refreshToken.update({
        where: { id: replaceTokenId },
        data: { revokedAt: new Date(), replacedBy: created.id },
      });
    }

    return {
      accessToken,
      refreshToken,
      expiresIn: accessExpiresIn,
      tokenType: 'Bearer',
    };
  }

  private buildRegisterResponse(
    user: {
      id: string;
      displayName: string | null;
      category: UserCategory;
      status: UserStatus;
      createdAt: Date;
    },
    device: {
      id: string;
      installationId: string;
      revokedAt: Date | null;
    },
    trial: {
      status: TrialGrantStatus;
      expiresAt: Date;
    } | null,
    tokens: MobileAuthTokens,
  ) {
    return {
      tokens,
      user: {
        id: user.id,
        displayName: user.displayName,
        category: user.category,
        status: user.status,
        createdAt: user.createdAt,
      },
      device: {
        id: device.id,
        installationId: device.installationId,
        status: device.revokedAt ? 'REVOKED' : 'ACTIVE',
      },
      trial: trial
        ? {
            status: trial.status,
            expiresAt: trial.expiresAt,
          }
        : null,
    };
  }

  private async getTrialDurationHours(
    tx: Pick<PrismaService, 'systemConfig'> = this.prisma,
  ): Promise<number> {
    const row = await tx.systemConfig.findUnique({ where: { key: 'TRIAL_DURATION_HOURS' } });
    const parsed = Number.parseInt(row?.value ?? '24', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 24;
  }

  private parseExpiresInSeconds(value: string): number {
    const match = /^(\d+)([smhd])$/.exec(value.trim());
    if (!match) {
      return 900;
    }

    const amount = Number.parseInt(match[1], 10);
    switch (match[2]) {
      case 's':
        return amount;
      case 'm':
        return amount * 60;
      case 'h':
        return amount * 3600;
      case 'd':
        return amount * 86400;
      default:
        return 900;
    }
  }
}
