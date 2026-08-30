# Telegram Payment Flow

> Architecture reference. Implementation: BLOCK 5.

## Flow

```
User Telegram Bot
    → select STANDARD (monthly/yearly)
    → create Order (PENDING)
    → show payment instructions (SystemConfig)
    → user sends receipt photo/document
    → Receipt stored, Order → RECEIPT_SUBMITTED / UNDER_REVIEW
    → Admin Telegram Bot notifies administrator
    → APPROVE / REJECT
    → PaymentApprovalService (single domain service)
    → Order COMPLETED + License created
    → NotificationOutbox → deliver key to user via Telegram
```

## Critical rule

**One service for approval:**

```
PaymentApprovalService
    ↑                    ↑
Admin Telegram Bot    Admin API (/api/v1/admin/orders/:id/approve)
```

No duplicated approval logic.

## Idempotency

- Approve operation keyed by `orderId`
- Second approve must not create second license

## License delivery

- DB transaction commits before Telegram send
- `NotificationOutbox` tracks delivery retries
- Telegram API failure must not roll back paid license

## Vercel note

Telegram **polling bots** cannot run reliably on Vercel serverless.

Options for production:

1. Separate worker service (Railway/Fly.io/VPS) for bots
2. Telegram webhooks to a dedicated endpoint (still needs always-on or queue consumer)

Document deployment split when implementing BLOCK 5.
