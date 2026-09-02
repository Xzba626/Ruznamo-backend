-- AlterTable License: purchaser/holder Telegram FK
ALTER TABLE "License" ADD COLUMN "purchaserTelegramAccountId" TEXT;
ALTER TABLE "License" ADD COLUMN "holderTelegramAccountId" TEXT;
ALTER TABLE "License" ADD COLUMN "holderLinkedAt" TIMESTAMPTZ(3);

-- CreateTable LicenseHolderHistory
CREATE TABLE "LicenseHolderHistory" (
    "id" TEXT NOT NULL,
    "licenseId" TEXT NOT NULL,
    "fromTelegramAccountId" TEXT,
    "toTelegramAccountId" TEXT,
    "reason" TEXT NOT NULL,
    "actorType" "AuditActorType" NOT NULL,
    "actorId" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LicenseHolderHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable TelegramLicenseLinkChallenge
CREATE TABLE "TelegramLicenseLinkChallenge" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "licenseId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "mobileUserId" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "consumedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TelegramLicenseLinkChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable DeviceReplacementChallenge
CREATE TABLE "DeviceReplacementChallenge" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "licenseId" TEXT NOT NULL,
    "newDeviceId" TEXT NOT NULL,
    "oldDeviceId" TEXT NOT NULL,
    "mobileUserId" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "consumedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DeviceReplacementChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "License_purchaserTelegramAccountId_idx" ON "License"("purchaserTelegramAccountId");
CREATE INDEX "License_holderTelegramAccountId_idx" ON "License"("holderTelegramAccountId");
CREATE UNIQUE INDEX "TelegramLicenseLinkChallenge_token_key" ON "TelegramLicenseLinkChallenge"("token");
CREATE INDEX "TelegramLicenseLinkChallenge_expiresAt_idx" ON "TelegramLicenseLinkChallenge"("expiresAt");
CREATE INDEX "TelegramLicenseLinkChallenge_licenseId_idx" ON "TelegramLicenseLinkChallenge"("licenseId");
CREATE UNIQUE INDEX "DeviceReplacementChallenge_token_key" ON "DeviceReplacementChallenge"("token");
CREATE INDEX "DeviceReplacementChallenge_expiresAt_idx" ON "DeviceReplacementChallenge"("expiresAt");
CREATE INDEX "DeviceReplacementChallenge_licenseId_idx" ON "DeviceReplacementChallenge"("licenseId");
CREATE INDEX "LicenseHolderHistory_licenseId_createdAt_idx" ON "LicenseHolderHistory"("licenseId", "createdAt");

-- AddForeignKey
ALTER TABLE "License" ADD CONSTRAINT "License_purchaserTelegramAccountId_fkey" FOREIGN KEY ("purchaserTelegramAccountId") REFERENCES "TelegramAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "License" ADD CONSTRAINT "License_holderTelegramAccountId_fkey" FOREIGN KEY ("holderTelegramAccountId") REFERENCES "TelegramAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LicenseHolderHistory" ADD CONSTRAINT "LicenseHolderHistory_licenseId_fkey" FOREIGN KEY ("licenseId") REFERENCES "License"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LicenseHolderHistory" ADD CONSTRAINT "LicenseHolderHistory_fromTelegramAccountId_fkey" FOREIGN KEY ("fromTelegramAccountId") REFERENCES "TelegramAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LicenseHolderHistory" ADD CONSTRAINT "LicenseHolderHistory_toTelegramAccountId_fkey" FOREIGN KEY ("toTelegramAccountId") REFERENCES "TelegramAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TelegramLicenseLinkChallenge" ADD CONSTRAINT "TelegramLicenseLinkChallenge_licenseId_fkey" FOREIGN KEY ("licenseId") REFERENCES "License"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TelegramLicenseLinkChallenge" ADD CONSTRAINT "TelegramLicenseLinkChallenge_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "DeviceInstallation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TelegramLicenseLinkChallenge" ADD CONSTRAINT "TelegramLicenseLinkChallenge_mobileUserId_fkey" FOREIGN KEY ("mobileUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeviceReplacementChallenge" ADD CONSTRAINT "DeviceReplacementChallenge_licenseId_fkey" FOREIGN KEY ("licenseId") REFERENCES "License"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeviceReplacementChallenge" ADD CONSTRAINT "DeviceReplacementChallenge_newDeviceId_fkey" FOREIGN KEY ("newDeviceId") REFERENCES "DeviceInstallation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeviceReplacementChallenge" ADD CONSTRAINT "DeviceReplacementChallenge_oldDeviceId_fkey" FOREIGN KEY ("oldDeviceId") REFERENCES "DeviceInstallation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeviceReplacementChallenge" ADD CONSTRAINT "DeviceReplacementChallenge_mobileUserId_fkey" FOREIGN KEY ("mobileUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Safe backfill: TELEGRAM_PAYMENT licenses where purchaser User has exactly one TelegramAccount
UPDATE "License" l
SET
  "purchaserTelegramAccountId" = ta."id",
  "holderTelegramAccountId" = ta."id",
  "holderLinkedAt" = COALESCE(l."holderLinkedAt", l."createdAt")
FROM "TelegramAccount" ta
WHERE l."userId" = ta."userId"
  AND l."issueSource" = 'TELEGRAM_PAYMENT'
  AND l."purchaserTelegramAccountId" IS NULL;
