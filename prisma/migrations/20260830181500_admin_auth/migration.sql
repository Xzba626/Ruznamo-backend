-- Admin auth sessions and Telegram identity linking
CREATE TABLE "AdminRefreshToken" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "revokedAt" TIMESTAMPTZ(3),
    "replacedBy" TEXT,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminRefreshToken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AdminTelegramIdentity" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "telegramUserId" BIGINT NOT NULL,
    "chatId" BIGINT,
    "username" TEXT,
    "firstName" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMPTZ(3),
    "lastSeenAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AdminTelegramIdentity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AdminTelegramLinkToken" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "usedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminTelegramLinkToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdminRefreshToken_tokenHash_key" ON "AdminRefreshToken"("tokenHash");
CREATE INDEX "AdminRefreshToken_adminUserId_idx" ON "AdminRefreshToken"("adminUserId");
CREATE INDEX "AdminRefreshToken_expiresAt_idx" ON "AdminRefreshToken"("expiresAt");

CREATE UNIQUE INDEX "AdminTelegramIdentity_adminUserId_key" ON "AdminTelegramIdentity"("adminUserId");
CREATE UNIQUE INDEX "AdminTelegramIdentity_telegramUserId_key" ON "AdminTelegramIdentity"("telegramUserId");
CREATE INDEX "AdminTelegramIdentity_isVerified_idx" ON "AdminTelegramIdentity"("isVerified");

CREATE UNIQUE INDEX "AdminTelegramLinkToken_code_key" ON "AdminTelegramLinkToken"("code");
CREATE INDEX "AdminTelegramLinkToken_adminUserId_idx" ON "AdminTelegramLinkToken"("adminUserId");
CREATE INDEX "AdminTelegramLinkToken_expiresAt_idx" ON "AdminTelegramLinkToken"("expiresAt");

ALTER TABLE "AdminRefreshToken" ADD CONSTRAINT "AdminRefreshToken_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdminTelegramIdentity" ADD CONSTRAINT "AdminTelegramIdentity_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdminTelegramLinkToken" ADD CONSTRAINT "AdminTelegramLinkToken_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
