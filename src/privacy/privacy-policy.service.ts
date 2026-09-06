import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { AdminRoleCode, AuditActorType, Prisma, PrivacyPolicyStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  DEFAULT_PRIVACY_CONTENT_RU,
  DEFAULT_PRIVACY_CONTENT_TG,
} from './privacy-policy.defaults';
import { assertPrivacyContentReady, sanitizePrivacyContent } from './privacy-content.util';

@Injectable()
export class PrivacyPolicyService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async onModuleInit() {
    await this.ensurePermissions();
    await this.ensureInitialPublished();
  }

  /** Public: current published policy for Android. */
  async getPublished(lang?: string) {
    const published = await this.prisma.privacyPolicyRevision.findFirst({
      where: { status: PrivacyPolicyStatus.PUBLISHED },
      orderBy: { revision: 'desc' },
    });
    if (!published) {
      return this.fallbackPublic(lang);
    }
    return this.toPublic(published, lang);
  }

  async getAdminOverview() {
    const [published, draft, history] = await Promise.all([
      this.prisma.privacyPolicyRevision.findFirst({
        where: { status: PrivacyPolicyStatus.PUBLISHED },
        orderBy: { revision: 'desc' },
      }),
      this.prisma.privacyPolicyRevision.findFirst({
        where: { status: PrivacyPolicyStatus.DRAFT },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.privacyPolicyRevision.findMany({
        where: { status: { in: [PrivacyPolicyStatus.PUBLISHED, PrivacyPolicyStatus.ARCHIVED] } },
        orderBy: { revision: 'desc' },
        take: 30,
      }),
    ]);

    return {
      current: published ? this.toAdmin(published) : null,
      draft: draft ? this.toAdmin(draft) : null,
      history: history.map((row) => this.toAdmin(row)),
    };
  }

  async saveDraft(
    adminId: string,
    body: { contentRu?: string; contentTg?: string; id?: string },
  ) {
    const contentRu =
      body.contentRu !== undefined ? sanitizePrivacyContent(body.contentRu) : undefined;
    const contentTg =
      body.contentTg !== undefined ? sanitizePrivacyContent(body.contentTg) : undefined;

    if (body.id) {
      const existing = await this.prisma.privacyPolicyRevision.findUnique({ where: { id: body.id } });
      if (!existing) {
        throw new NotFoundException({ code: 'PRIVACY_NOT_FOUND', message: 'Privacy draft not found' });
      }
      if (existing.status !== PrivacyPolicyStatus.DRAFT) {
        throw new BadRequestException({
          code: 'PRIVACY_NOT_DRAFT',
          message: 'Only draft revisions can be edited',
        });
      }
      const updated = await this.prisma.privacyPolicyRevision.update({
        where: { id: existing.id },
        data: {
          ...(contentRu !== undefined ? { contentRu } : {}),
          ...(contentTg !== undefined ? { contentTg } : {}),
          updatedByAdminId: adminId,
        },
      });
      return this.toAdmin(updated);
    }

    const existingDraft = await this.prisma.privacyPolicyRevision.findFirst({
      where: { status: PrivacyPolicyStatus.DRAFT },
      orderBy: { updatedAt: 'desc' },
    });
    if (existingDraft) {
      const updated = await this.prisma.privacyPolicyRevision.update({
        where: { id: existingDraft.id },
        data: {
          ...(contentRu !== undefined ? { contentRu } : {}),
          ...(contentTg !== undefined ? { contentTg } : {}),
          updatedByAdminId: adminId,
        },
      });
      return this.toAdmin(updated);
    }

    const maxRev = await this.prisma.privacyPolicyRevision.aggregate({ _max: { revision: true } });
    const nextRevision = (maxRev._max.revision ?? 0) + 1;
    const base =
      (await this.prisma.privacyPolicyRevision.findFirst({
        where: { status: PrivacyPolicyStatus.PUBLISHED },
        orderBy: { revision: 'desc' },
      })) ?? null;

    const created = await this.prisma.privacyPolicyRevision.create({
      data: {
        revision: nextRevision,
        contentRu: contentRu ?? base?.contentRu ?? DEFAULT_PRIVACY_CONTENT_RU,
        contentTg: contentTg ?? base?.contentTg ?? DEFAULT_PRIVACY_CONTENT_TG,
        status: PrivacyPolicyStatus.DRAFT,
        createdByAdminId: adminId,
        updatedByAdminId: adminId,
      },
    });
    return this.toAdmin(created);
  }

  async publish(adminId: string, draftId: string) {
    const draft = await this.prisma.privacyPolicyRevision.findUnique({ where: { id: draftId } });
    if (!draft) {
      throw new NotFoundException({ code: 'PRIVACY_NOT_FOUND', message: 'Privacy draft not found' });
    }
    if (draft.status !== PrivacyPolicyStatus.DRAFT) {
      throw new BadRequestException({
        code: 'PRIVACY_NOT_DRAFT',
        message: 'Only draft revisions can be published',
      });
    }

    const ready = assertPrivacyContentReady(draft.contentRu, draft.contentTg);
    if (!ready.ok) {
      throw new BadRequestException({
        code: 'PRIVACY_LOCALE_REQUIRED',
        message: `Cannot publish incomplete policy. Missing: ${ready.missing.join(', ')}`,
        missingLocales: ready.missing,
      });
    }

    const now = new Date();
    let published;
    try {
      published = await this.prisma.$transaction(
        async (tx) => {
          await tx.$executeRaw`
            SELECT pg_advisory_xact_lock(hashtext('ruznamo_privacy_publish'))
          `;

          await tx.privacyPolicyRevision.updateMany({
            where: {
              status: PrivacyPolicyStatus.PUBLISHED,
              id: { not: draft.id },
            },
            data: { status: PrivacyPolicyStatus.ARCHIVED, archivedAt: now },
          });

          const updated = await tx.privacyPolicyRevision.update({
            where: { id: draft.id },
            data: {
              status: PrivacyPolicyStatus.PUBLISHED,
              publishedAt: now,
              updatedByAdminId: adminId,
            },
          });

          const count = await tx.privacyPolicyRevision.count({
            where: { status: PrivacyPolicyStatus.PUBLISHED },
          });
          if (count !== 1) {
            throw new ConflictException({
              code: 'PRIVACY_PUBLISHED_INVARIANT',
              message: `Expected exactly one published privacy policy, found ${count}`,
            });
          }
          return updated;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === 'P2002' || error.code === 'P2034')
      ) {
        throw new ConflictException({
          code: 'PRIVACY_PUBLISH_CONFLICT',
          message: 'Another privacy publish is in progress',
        });
      }
      throw error;
    }

    await this.auditService.log({
      actorType: AuditActorType.ADMIN,
      actorId: adminId,
      action: 'privacy.published',
      entityType: 'PrivacyPolicyRevision',
      entityId: published.id,
      metadata: { revision: published.revision },
    });

    return this.toAdmin(published);
  }

  async getById(id: string) {
    const row = await this.prisma.privacyPolicyRevision.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException({ code: 'PRIVACY_NOT_FOUND', message: 'Privacy revision not found' });
    }
    return this.toAdmin(row);
  }

  private async ensureInitialPublished() {
    const any = await this.prisma.privacyPolicyRevision.count();
    if (any > 0) return;

    await this.prisma.privacyPolicyRevision.create({
      data: {
        revision: 1,
        contentRu: sanitizePrivacyContent(DEFAULT_PRIVACY_CONTENT_RU),
        contentTg: sanitizePrivacyContent(DEFAULT_PRIVACY_CONTENT_TG),
        status: PrivacyPolicyStatus.PUBLISHED,
        publishedAt: new Date(),
      },
    });
  }

  private async ensurePermissions() {
    const codes = [
      { code: 'content:read', name: 'Read content (privacy policy)' },
      { code: 'content:manage', name: 'Manage content (privacy policy)' },
    ];
    for (const p of codes) {
      await this.prisma.permission.upsert({
        where: { code: p.code },
        update: { name: p.name },
        create: p,
      });
    }
    const perms = await this.prisma.permission.findMany({
      where: { code: { in: codes.map((c) => c.code) } },
    });
    const roles = await this.prisma.role.findMany({
      where: { code: { in: [AdminRoleCode.SUPER_ADMIN, AdminRoleCode.ADMIN] } },
    });
    for (const role of roles) {
      for (const perm of perms) {
        await this.prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: { roleId: role.id, permissionId: perm.id },
          },
          update: {},
          create: { roleId: role.id, permissionId: perm.id },
        });
      }
    }
  }

  private fallbackPublic(lang?: string) {
    const isTj = (lang ?? 'ru').toLowerCase().startsWith('tj');
    return {
      revision: 0,
      status: 'PUBLISHED' as const,
      publishedAt: null,
      updatedAt: null,
      language: isTj ? 'tj' : 'ru',
      content: isTj ? DEFAULT_PRIVACY_CONTENT_TG : DEFAULT_PRIVACY_CONTENT_RU,
      source: 'builtin_fallback' as const,
    };
  }

  private toPublic(
    row: {
      revision: number;
      contentRu: string;
      contentTg: string;
      publishedAt: Date | null;
      updatedAt: Date;
    },
    lang?: string,
  ) {
    const isTj = (lang ?? 'ru').toLowerCase().startsWith('tj');
    return {
      revision: row.revision,
      status: 'PUBLISHED' as const,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      updatedAt: row.updatedAt.toISOString(),
      language: isTj ? 'tj' : 'ru',
      content: isTj ? row.contentTg : row.contentRu,
      source: 'backend' as const,
    };
  }

  private toAdmin(row: {
    id: string;
    revision: number;
    contentRu: string;
    contentTg: string;
    status: PrivacyPolicyStatus;
    createdAt: Date;
    updatedAt: Date;
    publishedAt: Date | null;
    archivedAt: Date | null;
  }) {
    const ready = assertPrivacyContentReady(row.contentRu, row.contentTg);
    return {
      id: row.id,
      revision: row.revision,
      contentRu: row.contentRu,
      contentTg: row.contentTg,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      publishedAt: row.publishedAt?.toISOString() ?? null,
      archivedAt: row.archivedAt?.toISOString() ?? null,
      publishReady: ready.ok,
      missingLocales: ready.missing,
    };
  }
}
