-- Privacy policy revisions (RU + TJ). Max one PUBLISHED at a time.

CREATE TYPE "PrivacyPolicyStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

CREATE TABLE "PrivacyPolicyRevision" (
  "id" TEXT NOT NULL,
  "revision" INTEGER NOT NULL,
  "contentRu" TEXT NOT NULL,
  "contentTg" TEXT NOT NULL,
  "status" "PrivacyPolicyStatus" NOT NULL DEFAULT 'DRAFT',
  "createdByAdminId" TEXT,
  "updatedByAdminId" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  "publishedAt" TIMESTAMPTZ(3),
  "archivedAt" TIMESTAMPTZ(3),

  CONSTRAINT "PrivacyPolicyRevision_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PrivacyPolicyRevision_revision_key" ON "PrivacyPolicyRevision"("revision");
CREATE INDEX "PrivacyPolicyRevision_status_idx" ON "PrivacyPolicyRevision"("status");
CREATE INDEX "PrivacyPolicyRevision_publishedAt_idx" ON "PrivacyPolicyRevision"("publishedAt");

CREATE UNIQUE INDEX "PrivacyPolicyRevision_one_published_idx"
  ON "PrivacyPolicyRevision" ("status")
  WHERE "status" = 'PUBLISHED';

ALTER TABLE "PrivacyPolicyRevision"
  ADD CONSTRAINT "PrivacyPolicyRevision_createdByAdminId_fkey"
  FOREIGN KEY ("createdByAdminId") REFERENCES "AdminUser"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PrivacyPolicyRevision"
  ADD CONSTRAINT "PrivacyPolicyRevision_updatedByAdminId_fkey"
  FOREIGN KEY ("updatedByAdminId") REFERENCES "AdminUser"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
