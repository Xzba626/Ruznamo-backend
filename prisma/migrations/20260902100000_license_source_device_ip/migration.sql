-- CreateEnum
CREATE TYPE "LicenseIssueSource" AS ENUM ('TELEGRAM_PAYMENT', 'ADMIN_MANUAL', 'UNKNOWN_LEGACY');

-- AlterTable
ALTER TABLE "License" ADD COLUMN     "issueSource" "LicenseIssueSource",
ADD COLUMN     "issuedByAdminId" TEXT,
ADD COLUMN     "adminNote" TEXT,
ADD COLUMN     "customerLabel" TEXT;

-- AlterTable
ALTER TABLE "DeviceInstallation" ADD COLUMN     "registrationIp" TEXT,
ADD COLUMN     "lastSeenIp" TEXT,
ADD COLUMN     "androidOsVersion" TEXT,
ADD COLUMN     "deviceManufacturer" TEXT,
ADD COLUMN     "deviceModel" TEXT;

-- AddForeignKey
ALTER TABLE "License" ADD CONSTRAINT "License_issuedByAdminId_fkey" FOREIGN KEY ("issuedByAdminId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill issue source
UPDATE "License" SET "issueSource" = 'TELEGRAM_PAYMENT' WHERE "orderId" IS NOT NULL;
UPDATE "License" SET "issueSource" = 'UNKNOWN_LEGACY' WHERE "issueSource" IS NULL;
