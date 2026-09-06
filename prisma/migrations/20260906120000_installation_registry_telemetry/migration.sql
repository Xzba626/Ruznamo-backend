-- Installation Registry: non-invasive metadata + client-reported access (risk signal only).
-- Non-destructive: ADD COLUMN only.

ALTER TABLE "DeviceInstallation" ADD COLUMN IF NOT EXISTS "sdkLevel" INTEGER;
ALTER TABLE "DeviceInstallation" ADD COLUMN IF NOT EXISTS "appLanguage" TEXT;
ALTER TABLE "DeviceInstallation" ADD COLUMN IF NOT EXISTS "themeMode" TEXT;
ALTER TABLE "DeviceInstallation" ADD COLUMN IF NOT EXISTS "packageName" TEXT;
ALTER TABLE "DeviceInstallation" ADD COLUMN IF NOT EXISTS "clientReportedAccessState" TEXT;
ALTER TABLE "DeviceInstallation" ADD COLUMN IF NOT EXISTS "clientReportedAccessAt" TIMESTAMPTZ(3);

CREATE INDEX IF NOT EXISTS "DeviceInstallation_lastSeenAt_idx" ON "DeviceInstallation"("lastSeenAt");
CREATE INDEX IF NOT EXISTS "DeviceInstallation_clientReportedAccessState_idx" ON "DeviceInstallation"("clientReportedAccessState");
