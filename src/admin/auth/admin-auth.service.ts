import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuditActorType } from '@prisma/client';
import { AuditService } from '../../audit/audit.service';
import { PasswordService } from '../../security/password.service';
import { TokenHashService } from '../../security/token-hash.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminJwtPayload } from './admin-jwt.payload';

export interface AdminAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

export interface AdminProfile {
  id: string;
  email: string;
  displayName: string | null;
  roles: string[];
  permissions: string[];
  isActive: boolean;
  createdAt: Date;
  lastLoginAt: Date | null;
  telegramConnected: boolean;
}

interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AdminAuthService {
  private readonly invalidCredentialsMessage = 'Invalid username or password';

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly tokenHashService: TokenHashService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) {}

  async login(
    username: string,
    password: string,
    meta: RequestMeta,
  ): Promise<{ tokens: AdminAuthTokens; admin: AdminProfile }> {
    const email = username.trim().toLowerCase();

    const admin = await this.prisma.adminUser.findUnique({
      where: { email },
      include: this.adminInclude(),
    });

    if (!admin || !admin.isActive) {
      await this.auditService.log({
        actorType: AuditActorType.ADMIN,
        action: 'admin.login.failed',
        entityType: 'AdminUser',
        metadata: { email },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
      throw new UnauthorizedException(this.invalidCredentialsMessage);
    }

    const passwordValid = await this.passwordService.verify(password, admin.passwordHash);
    if (!passwordValid) {
      await this.auditService.log({
        actorType: AuditActorType.ADMIN,
        actorId: admin.id,
        action: 'admin.login.failed',
        entityType: 'AdminUser',
        entityId: admin.id,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
      throw new UnauthorizedException(this.invalidCredentialsMessage);
    }

    const { roles, permissions } = this.extractRolesAndPermissions(admin);
    const tokens = await this.issueTokenPair(admin.id, admin.email, roles, permissions, meta);

    await this.prisma.adminUser.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });

    await this.auditService.log({
      actorType: AuditActorType.ADMIN,
      actorId: admin.id,
      action: 'admin.login.success',
      entityType: 'AdminUser',
      entityId: admin.id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return {
      tokens,
      admin: this.toProfile(admin, roles, permissions),
    };
  }

  async refresh(refreshToken: string, meta: RequestMeta): Promise<AdminAuthTokens> {
    const tokenHash = this.tokenHashService.hashToken(refreshToken);
    const stored = await this.prisma.adminRefreshToken.findUnique({
      where: { tokenHash },
      include: {
        adminUser: {
          include: this.adminInclude(),
        },
      },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (!stored.adminUser.isActive) {
      throw new ForbiddenException('Admin account is inactive');
    }

    const { roles, permissions } = this.extractRolesAndPermissions(stored.adminUser);
    const tokens = await this.issueTokenPair(
      stored.adminUser.id,
      stored.adminUser.email,
      roles,
      permissions,
      meta,
      stored.id,
    );

    await this.auditService.log({
      actorType: AuditActorType.ADMIN,
      actorId: stored.adminUser.id,
      action: 'admin.token.refresh',
      entityType: 'AdminRefreshToken',
      entityId: stored.id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return tokens;
  }

  async logout(
    adminId: string,
    refreshToken: string | undefined,
    meta: RequestMeta,
  ): Promise<void> {
    if (refreshToken) {
      const tokenHash = this.tokenHashService.hashToken(refreshToken);
      await this.prisma.adminRefreshToken.updateMany({
        where: {
          adminUserId: adminId,
          tokenHash,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });
    }

    await this.auditService.log({
      actorType: AuditActorType.ADMIN,
      actorId: adminId,
      action: 'admin.logout',
      entityType: 'AdminUser',
      entityId: adminId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
  }

  async getProfile(adminId: string): Promise<AdminProfile> {
    const admin = await this.prisma.adminUser.findUnique({
      where: { id: adminId },
      include: this.adminInclude(),
    });

    if (!admin || !admin.isActive) {
      throw new UnauthorizedException('Admin account not found');
    }

    const { roles, permissions } = this.extractRolesAndPermissions(admin);
    return this.toProfile(admin, roles, permissions);
  }

  async changePassword(
    adminId: string,
    currentPassword: string,
    newPassword: string,
    meta: RequestMeta,
  ): Promise<void> {
    if (newPassword.length < 12) {
      throw new BadRequestException('New password must be at least 12 characters');
    }

    const admin = await this.prisma.adminUser.findUnique({ where: { id: adminId } });
    if (!admin || !admin.isActive) {
      throw new UnauthorizedException('Admin account not found');
    }

    const valid = await this.passwordService.verify(currentPassword, admin.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const passwordHash = await this.passwordService.hash(newPassword);
    await this.prisma.$transaction([
      this.prisma.adminUser.update({
        where: { id: adminId },
        data: { passwordHash },
      }),
      this.prisma.adminRefreshToken.updateMany({
        where: { adminUserId: adminId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    await this.auditService.log({
      actorType: AuditActorType.ADMIN,
      actorId: adminId,
      action: 'admin.password.changed',
      entityType: 'AdminUser',
      entityId: adminId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
  }

  private async issueTokenPair(
    adminUserId: string,
    email: string,
    roles: string[],
    permissions: string[],
    meta: RequestMeta,
    replaceTokenId?: string,
  ): Promise<AdminAuthTokens> {
    const accessExpiresIn = this.parseExpiresInSeconds(
      this.configService.get<string>('jwt.accessExpiresIn', '15m'),
    );
    const refreshExpiresIn = this.parseExpiresInSeconds(
      this.configService.get<string>('jwt.refreshExpiresIn', '30d'),
    );

    const audience = this.configService.get<string>('jwt.adminAudience', 'ruznamo-admin');

    const payload: Omit<AdminJwtPayload, 'aud'> = {
      sub: adminUserId,
      email,
      roles,
      permissions,
      type: 'access',
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('jwt.accessSecret'),
      expiresIn: accessExpiresIn,
      audience,
    });

    const refreshToken = this.tokenHashService.generateOpaqueToken();
    const tokenHash = this.tokenHashService.hashToken(refreshToken);

    const created = await this.prisma.adminRefreshToken.create({
      data: {
        adminUserId,
        tokenHash,
        expiresAt: new Date(Date.now() + refreshExpiresIn * 1000),
        userAgent: meta.userAgent,
        ipAddress: meta.ipAddress,
      },
    });

    if (replaceTokenId) {
      await this.prisma.adminRefreshToken.update({
        where: { id: replaceTokenId },
        data: {
          revokedAt: new Date(),
          replacedBy: created.id,
        },
      });
    }

    return {
      accessToken,
      refreshToken,
      expiresIn: accessExpiresIn,
      tokenType: 'Bearer',
    };
  }

  private adminInclude() {
    return {
      roles: {
        include: {
          role: {
            include: {
              permissions: {
                include: { permission: true },
              },
            },
          },
        },
      },
      telegramIdentity: true,
    } as const;
  }

  private extractRolesAndPermissions(admin: {
    roles: Array<{
      role: {
        code: string;
        permissions: Array<{ permission: { code: string } }>;
      };
    }>;
  }): { roles: string[]; permissions: string[] } {
    const roles = admin.roles.map((entry) => entry.role.code);
    const permissionSet = new Set<string>();

    for (const entry of admin.roles) {
      for (const rolePermission of entry.role.permissions) {
        permissionSet.add(rolePermission.permission.code);
      }
    }

    return {
      roles,
      permissions: [...permissionSet].sort(),
    };
  }

  private toProfile(
    admin: {
      id: string;
      email: string;
      displayName: string | null;
      isActive: boolean;
      createdAt: Date;
      lastLoginAt: Date | null;
      telegramIdentity: { isVerified: boolean } | null;
    },
    roles: string[],
    permissions: string[],
  ): AdminProfile {
    return {
      id: admin.id,
      email: admin.email,
      displayName: admin.displayName,
      roles,
      permissions,
      isActive: admin.isActive,
      createdAt: admin.createdAt,
      lastLoginAt: admin.lastLoginAt,
      telegramConnected: Boolean(admin.telegramIdentity?.isVerified),
    };
  }

  private parseExpiresInSeconds(value: string): number {
    const match = /^(\d+)([smhd])$/.exec(value.trim());
    if (!match) {
      return 900;
    }

    const amount = Number.parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
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
