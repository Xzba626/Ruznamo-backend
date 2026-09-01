-- Disable Pro for new purchases (Standard remains available).
UPDATE "Plan" SET "isActive" = false, "updatedAt" = NOW() WHERE "code" = 'PRO';
