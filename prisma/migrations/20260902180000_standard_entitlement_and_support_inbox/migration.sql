-- Standard: max_devices 2, monthly price 20 TJS (yearly unchanged)
UPDATE "PlanFeature" pf
SET value = '2', "updatedAt" = NOW()
FROM "Plan" p
WHERE pf."planId" = p.id
  AND p.code = 'STANDARD'
  AND pf.key = 'max_devices';

UPDATE "PlanPrice" pp
SET amount = 20.00, "updatedAt" = NOW()
FROM "Plan" p
WHERE pp."planId" = p.id
  AND p.code = 'STANDARD'
  AND pp."billingPeriod" = 'MONTHLY';

-- TelegramAuthPurpose: LINK_ACCOUNT
ALTER TYPE "TelegramAuthPurpose" ADD VALUE IF NOT EXISTS 'LINK_ACCOUNT';

-- Support inbox persistence
CREATE TYPE "SupportConversationStatus" AS ENUM ('OPEN', 'CLOSED');

CREATE TYPE "SupportMessageDirection" AS ENUM ('USER_TO_ADMIN', 'ADMIN_TO_USER');

CREATE TYPE "SupportMessageContentType" AS ENUM ('TEXT', 'PHOTO', 'DOCUMENT');

CREATE TABLE "SupportConversation" (
    "id" TEXT NOT NULL,
    "telegramAccountId" TEXT NOT NULL,
    "status" "SupportConversationStatus" NOT NULL DEFAULT 'OPEN',
    "category" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "closedAt" TIMESTAMPTZ(3),

    CONSTRAINT "SupportConversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupportMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "direction" "SupportMessageDirection" NOT NULL,
    "telegramMessageId" BIGINT,
    "contentType" "SupportMessageContentType" NOT NULL DEFAULT 'TEXT',
    "text" TEXT,
    "caption" TEXT,
    "fileId" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SupportConversation_telegramAccountId_status_idx" ON "SupportConversation"("telegramAccountId", "status");
CREATE INDEX "SupportConversation_updatedAt_idx" ON "SupportConversation"("updatedAt");
CREATE INDEX "SupportMessage_conversationId_createdAt_idx" ON "SupportMessage"("conversationId", "createdAt");

ALTER TABLE "SupportConversation" ADD CONSTRAINT "SupportConversation_telegramAccountId_fkey" FOREIGN KEY ("telegramAccountId") REFERENCES "TelegramAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "SupportConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Optional license context for LINK_ACCOUNT auth challenges
ALTER TABLE "TelegramAuthChallenge" ADD COLUMN IF NOT EXISTS "contextLicenseId" TEXT;

CREATE INDEX IF NOT EXISTS "TelegramAuthChallenge_contextLicenseId_idx" ON "TelegramAuthChallenge"("contextLicenseId");
