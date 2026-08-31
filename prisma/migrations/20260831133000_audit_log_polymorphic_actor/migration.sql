-- DropForeignKey
ALTER TABLE "AuditLog" DROP CONSTRAINT IF EXISTS "AuditLog_actorId_fkey";

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AuditLog_actorType_actorId_idx" ON "AuditLog"("actorType", "actorId");
