-- CreateEnum
CREATE TYPE "TelegramAuthPurpose" AS ENUM ('LOGIN', 'RECOVERY', 'DEVICE_REPLACEMENT', 'KEY_REVEAL');

-- CreateTable
CREATE TABLE "TelegramAuthChallenge" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "requestingDeviceId" TEXT NOT NULL,
    "requestingMobileUserId" TEXT NOT NULL,
    "purpose" "TelegramAuthPurpose" NOT NULL,
    "telegramAccountId" TEXT,
    "otpHash" TEXT,
    "otpExpiresAt" TIMESTAMPTZ(3),
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "verifiedAt" TIMESTAMPTZ(3),
    "consumedAt" TIMESTAMPTZ(3),
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelegramAuthChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelegramRecoveryGrant" (
    "id" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "telegramAccountId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "mobileUserId" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "consumedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelegramRecoveryGrant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TelegramAuthChallenge_tokenHash_key" ON "TelegramAuthChallenge"("tokenHash");

-- CreateIndex
CREATE INDEX "TelegramAuthChallenge_expiresAt_idx" ON "TelegramAuthChallenge"("expiresAt");

-- CreateIndex
CREATE INDEX "TelegramAuthChallenge_requestingDeviceId_createdAt_idx" ON "TelegramAuthChallenge"("requestingDeviceId", "createdAt");

-- CreateIndex
CREATE INDEX "TelegramAuthChallenge_telegramAccountId_idx" ON "TelegramAuthChallenge"("telegramAccountId");

-- CreateIndex
CREATE INDEX "TelegramRecoveryGrant_expiresAt_idx" ON "TelegramRecoveryGrant"("expiresAt");

-- CreateIndex
CREATE INDEX "TelegramRecoveryGrant_deviceId_mobileUserId_idx" ON "TelegramRecoveryGrant"("deviceId", "mobileUserId");

-- CreateIndex
CREATE INDEX "TelegramRecoveryGrant_telegramAccountId_idx" ON "TelegramRecoveryGrant"("telegramAccountId");

-- AddForeignKey
ALTER TABLE "TelegramAuthChallenge" ADD CONSTRAINT "TelegramAuthChallenge_requestingDeviceId_fkey" FOREIGN KEY ("requestingDeviceId") REFERENCES "DeviceInstallation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelegramAuthChallenge" ADD CONSTRAINT "TelegramAuthChallenge_requestingMobileUserId_fkey" FOREIGN KEY ("requestingMobileUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelegramAuthChallenge" ADD CONSTRAINT "TelegramAuthChallenge_telegramAccountId_fkey" FOREIGN KEY ("telegramAccountId") REFERENCES "TelegramAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelegramRecoveryGrant" ADD CONSTRAINT "TelegramRecoveryGrant_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "TelegramAuthChallenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelegramRecoveryGrant" ADD CONSTRAINT "TelegramRecoveryGrant_telegramAccountId_fkey" FOREIGN KEY ("telegramAccountId") REFERENCES "TelegramAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelegramRecoveryGrant" ADD CONSTRAINT "TelegramRecoveryGrant_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "DeviceInstallation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelegramRecoveryGrant" ADD CONSTRAINT "TelegramRecoveryGrant_mobileUserId_fkey" FOREIGN KEY ("mobileUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
