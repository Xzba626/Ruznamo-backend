-- CreateTable
CREATE TABLE "SupportRelayMapping" (
    "id" TEXT NOT NULL,
    "adminChatId" BIGINT NOT NULL,
    "adminMessageId" INTEGER NOT NULL,
    "userChatId" BIGINT NOT NULL,
    "userTelegramId" BIGINT NOT NULL,
    "sourceUserMessageId" INTEGER,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportRelayMapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SupportRelayMapping_adminChatId_adminMessageId_key" ON "SupportRelayMapping"("adminChatId", "adminMessageId");

-- CreateIndex
CREATE INDEX "SupportRelayMapping_userTelegramId_idx" ON "SupportRelayMapping"("userTelegramId");

-- CreateIndex
CREATE INDEX "SupportRelayMapping_createdAt_idx" ON "SupportRelayMapping"("createdAt");
