-- Artifact deletion metadata (APK file removable; release history retained).
-- CRITICAL UPDATE-LIFECYCLE INVARIANT: at most one PUBLISHED release per platform.
--
-- If this unique index fails to create, production has PUBLISHED > 1 (DATA_INTEGRITY_FAIL).
-- Do NOT silently archive releases here — remediate only with owner confirmation.

ALTER TABLE "AppRelease" ADD COLUMN IF NOT EXISTS "artifactDeletedAt" TIMESTAMPTZ(3);
ALTER TABLE "AppRelease" ADD COLUMN IF NOT EXISTS "artifactDeletedByAdminId" TEXT;

-- Legacy PURGED rows: keep history as ARCHIVED with artifact marked deleted.
UPDATE "AppRelease"
SET
  "status" = 'ARCHIVED',
  "artifactDeletedAt" = COALESCE("artifactDeletedAt", NOW()),
  "archivedAt" = COALESCE("archivedAt", NOW())
WHERE "status" = 'PURGED' AND "artifactDeletedAt" IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AppRelease_artifactDeletedByAdminId_fkey'
  ) THEN
    ALTER TABLE "AppRelease"
      ADD CONSTRAINT "AppRelease_artifactDeletedByAdminId_fkey"
      FOREIGN KEY ("artifactDeletedByAdminId") REFERENCES "AdminUser"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "AppRelease_one_published_per_platform_idx"
  ON "AppRelease" ("platform")
  WHERE "status" = 'PUBLISHED';
