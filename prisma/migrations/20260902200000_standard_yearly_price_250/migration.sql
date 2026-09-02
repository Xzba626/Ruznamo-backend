-- Standard yearly price: 250 TJS (monthly remains 20 TJS)
UPDATE "PlanPrice" pp
SET amount = 250.00, "updatedAt" = NOW()
FROM "Plan" p
WHERE pp."planId" = p.id
  AND p.code = 'STANDARD'
  AND pp."billingPeriod" = 'YEARLY';
