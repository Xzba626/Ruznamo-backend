-- AlterTable
ALTER TABLE "RefreshToken" ADD COLUMN "deviceId" TEXT;

-- CreateIndex
CREATE INDEX "RefreshToken_deviceId_idx" ON "RefreshToken"("deviceId");

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "DeviceInstallation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
