-- AlterTable
ALTER TABLE "TelegramAccount" ADD COLUMN "chatId" BIGINT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "awaitingReceipt" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Receipt" ADD COLUMN "telegramUpdateId" BIGINT;

-- CreateIndex
CREATE INDEX "Order_userId_status_idx" ON "Order"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_telegramUpdateId_key" ON "Receipt"("telegramUpdateId");

-- CreateTable
CREATE TABLE "TelegramProcessedUpdate" (
    "updateId" BIGINT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelegramProcessedUpdate_pkey" PRIMARY KEY ("updateId")
);

-- CreateIndex
CREATE INDEX "NotificationOutbox_type_status_idx" ON "NotificationOutbox"("type", "status");
