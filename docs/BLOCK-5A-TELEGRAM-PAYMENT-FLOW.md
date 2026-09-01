# BLOCK 5A — Single Telegram Bot Payment & License Flow

## Architecture

One Telegram bot serves both users and administrators.

```
Telegram User / Admin
        ↓ HTTPS webhook
POST /api/v1/telegram/webhook
        ↓
TelegramUpdateProcessor
        ↓
Order + Receipt + PaymentApprovalService + License
        ↓
Neon PostgreSQL
```

Android continues to use mobile API only — never direct database access.

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `TELEGRAM_BOT_TOKEN` | BotFather token for the single bot |
| `TELEGRAM_BOT_USERNAME` | Optional deep link username |
| `TELEGRAM_WEBHOOK_SECRET` | Webhook HMAC header validation |
| `ADMIN_TELEGRAM_IDS` | Comma-separated numeric Telegram user IDs |

In production, when `TELEGRAM_BOT_TOKEN` is set, `TELEGRAM_WEBHOOK_SECRET` is required.

Deprecated (remove after migration):

- `TELEGRAM_USER_BOT_TOKEN`
- `TELEGRAM_ADMIN_BOT_TOKEN`
- `ADMIN_TELEGRAM_CHAT_ID`

## Webhook Setup

```bash
curl -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://ruznamo-backend-o4xk.vercel.app/api/v1/telegram/webhook",
    "secret_token": "<TELEGRAM_WEBHOOK_SECRET>"
  }'
```

Legacy admin webhook (`/api/v1/telegram/admin/webhook`) remains for CRM linking only.

## User Flow

1. `/start` → resolve `TelegramAccount` → `User`
2. If active license → subscription menu (Tajik)
3. Else → choose `1 моҳ` / `1 сол`
4. Show payment info from `PlanPrice` + `SystemConfig`
5. `Ман пардохт кардам` → order stays `PENDING`, awaiting receipt
6. User sends photo/document → `Receipt` → `UNDER_REVIEW`
7. Admins in `ADMIN_TELEGRAM_IDS` receive notification with approve/reject buttons

## Admin Flow

- Authorization: `from.id ∈ ADMIN_TELEGRAM_IDS`
- Approve → `PaymentApprovalService.approve()` → License (64-char key) → user message
- Reject → `REJECTED` → user message + retry button
- Duplicate approve is idempotent (no second license)

## Payment Configuration (SystemConfig)

- `PAYMENT_INSTRUCTIONS_TJ`
- `PAYMENT_CARD_NUMBER`
- `PAYMENT_RECIPIENT_NAME`

Prices from `PlanPrice` (STANDARD MONTHLY/YEARLY).

## Security

- Webhook secret required in production
- Admin callbacks validated by Telegram user ID
- License keys hashed at rest (`LicenseKeyService`)
- Plaintext key stored only in `NotificationOutbox` for resend (`Калиди ман`)
- Audit events for all payment actions

## Manual Testing

1. Set env vars on Vercel
2. Apply migration: `npx prisma migrate deploy`
3. Set webhook URL
4. Send `/start` as user
5. Complete payment flow with test receipt
6. Approve from admin Telegram account

## Deep Link (Android)

```
https://t.me/<TELEGRAM_BOT_USERNAME>
```

Android opens bot when trial expires.
