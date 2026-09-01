-- CreateEnum
CREATE TYPE "PaymentMethodType" AS ENUM ('PHONE', 'CARD');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "paymentMethodId" TEXT,
ADD COLUMN     "paymentMethodName" TEXT,
ADD COLUMN     "paymentMethodType" "PaymentMethodType",
ADD COLUMN     "paymentMethodValue" TEXT,
ADD COLUMN     "paymentMethodRecipient" TEXT;

-- CreateTable
CREATE TABLE "PaymentMethod" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "PaymentMethodType" NOT NULL,
    "paymentValue" TEXT NOT NULL,
    "recipientName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "PaymentMethod_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TelegramBotSession" (
    "telegramUserId" BIGINT NOT NULL,
    "flow" TEXT NOT NULL,
    "step" TEXT,
    "payload" JSONB,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "TelegramBotSession_pkey" PRIMARY KEY ("telegramUserId")
);

-- CreateIndex
CREATE INDEX "PaymentMethod_isActive_sortOrder_idx" ON "PaymentMethod"("isActive", "sortOrder");

CREATE INDEX "TelegramBotSession_expiresAt_idx" ON "TelegramBotSession"("expiresAt");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod"("id") ON DELETE SET NULL ON UPDATE CASCADE;
