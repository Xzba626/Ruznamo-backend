CREATE TYPE "AdminTelegramIdentityStatus" AS ENUM ('ACTIVE', 'REVOKED');

ALTER TABLE "AdminTelegramIdentity"
  ADD COLUMN "status" "AdminTelegramIdentityStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "revokedAt" TIMESTAMPTZ(3);

UPDATE "AdminTelegramIdentity"
SET "status" = 'ACTIVE'
WHERE "isVerified" = true;

CREATE INDEX "AdminTelegramIdentity_status_idx" ON "AdminTelegramIdentity"("status");

CREATE TABLE "AdminTelegramRevokedId" (
  "telegramUserId" BIGINT NOT NULL,
  "revokedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedByAdminUserId" TEXT,
  CONSTRAINT "AdminTelegramRevokedId_pkey" PRIMARY KEY ("telegramUserId")
);

CREATE INDEX "AdminTelegramRevokedId_revokedAt_idx" ON "AdminTelegramRevokedId"("revokedAt");

CREATE TABLE "AdminTelegramRebindChallenge" (
  "id" TEXT NOT NULL,
  "adminUserId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "otpHash" TEXT,
  "telegramUserId" BIGINT,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  "consumedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminTelegramRebindChallenge_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdminTelegramRebindChallenge_tokenHash_key" ON "AdminTelegramRebindChallenge"("tokenHash");
CREATE INDEX "AdminTelegramRebindChallenge_adminUserId_idx" ON "AdminTelegramRebindChallenge"("adminUserId");
CREATE INDEX "AdminTelegramRebindChallenge_expiresAt_idx" ON "AdminTelegramRebindChallenge"("expiresAt");

ALTER TABLE "AdminTelegramRebindChallenge"
  ADD CONSTRAINT "AdminTelegramRebindChallenge_adminUserId_fkey"
  FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
