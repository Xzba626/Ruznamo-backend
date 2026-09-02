-- Launch infrastructure: AppRelease, SystemSecurityCredential, device telemetry fields

CREATE TYPE "SystemSecurityCredentialType" AS ENUM ('DATA_RESET');
CREATE TYPE "AppReleaseStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED', 'PURGED');
CREATE TYPE "DataResetScope" AS ENUM ('TEST_DATA_CLEANUP', 'USER_DATA_RESET', 'FACTORY_RESET');

ALTER TABLE "DeviceInstallation"
  ADD COLUMN "appVersionName" TEXT,
  ADD COLUMN "appVersionCode" INTEGER,
  ADD COLUMN "appLocale" TEXT;

CREATE TABLE "AppRelease" (
  "id" TEXT NOT NULL,
  "platform" "Platform" NOT NULL DEFAULT 'ANDROID',
  "versionName" TEXT NOT NULL,
  "versionCode" INTEGER NOT NULL,
  "packageName" TEXT NOT NULL,
  "signingCertificateSha256" TEXT NOT NULL,
  "objectKey" TEXT NOT NULL,
  "fileSize" BIGINT NOT NULL,
  "sha256" TEXT NOT NULL,
  "status" "AppReleaseStatus" NOT NULL DEFAULT 'DRAFT',
  "mandatory" BOOLEAN NOT NULL DEFAULT false,
  "changelogRu" TEXT,
  "changelogTg" TEXT,
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "publishedAt" TIMESTAMPTZ(3),
  "archivedAt" TIMESTAMPTZ(3),
  CONSTRAINT "AppRelease_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SystemSecurityCredential" (
  "id" TEXT NOT NULL,
  "type" "SystemSecurityCredentialType" NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "passwordChangedAt" TIMESTAMPTZ(3) NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "SystemSecurityCredential_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AppRelease_platform_versionCode_key" ON "AppRelease"("platform", "versionCode");
CREATE INDEX "AppRelease_platform_status_idx" ON "AppRelease"("platform", "status");
CREATE INDEX "AppRelease_publishedAt_idx" ON "AppRelease"("publishedAt");
CREATE UNIQUE INDEX "SystemSecurityCredential_type_key" ON "SystemSecurityCredential"("type");

ALTER TABLE "AppRelease"
  ADD CONSTRAINT "AppRelease_createdByAdminId_fkey"
  FOREIGN KEY ("createdByAdminId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "Permission" ("id", "code", "name")
VALUES
  (gen_random_uuid()::text, 'system:read', 'Read system settings'),
  (gen_random_uuid()::text, 'system:reset', 'Execute data reset'),
  (gen_random_uuid()::text, 'releases:read', 'Read app releases'),
  (gen_random_uuid()::text, 'releases:manage', 'Manage app releases')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r.id, p.id
FROM "Role" r
CROSS JOIN "Permission" p
WHERE r.code = 'SUPER_ADMIN'
  AND p.code IN ('system:read', 'system:reset', 'releases:read', 'releases:manage')
ON CONFLICT DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r.id, p.id
FROM "Role" r
CROSS JOIN "Permission" p
WHERE r.code = 'ADMIN'
  AND p.code IN ('system:read', 'releases:read', 'releases:manage')
ON CONFLICT DO NOTHING;
