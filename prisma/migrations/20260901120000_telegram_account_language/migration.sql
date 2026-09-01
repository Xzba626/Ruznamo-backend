-- CreateEnum
CREATE TYPE "TelegramLanguage" AS ENUM ('TJ', 'RU');

-- AlterTable
ALTER TABLE "TelegramAccount" ADD COLUMN "language" "TelegramLanguage";
