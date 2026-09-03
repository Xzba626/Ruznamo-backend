-- Persist stable rejection reason code alongside human-readable rejectionReason text.
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "rejectionReasonCode" TEXT;
