-- LicenseActivation soft-revoke (per-license slot) — NOT DeviceInstallation global block
CREATE TYPE "LicenseActivationRevokeReason" AS ENUM (
  'HOLDER_DISCONNECT',
  'ADMIN_DISCONNECT',
  'DEVICE_REPLACEMENT'
);

ALTER TABLE "LicenseActivation"
  ADD COLUMN "revokedAt" TIMESTAMPTZ(3),
  ADD COLUMN "revokeReason" "LicenseActivationRevokeReason";

CREATE INDEX "LicenseActivation_licenseId_revokedAt_idx"
  ON "LicenseActivation"("licenseId", "revokedAt");

CREATE INDEX "LicenseActivation_deviceId_revokedAt_idx"
  ON "LicenseActivation"("deviceId", "revokedAt");
