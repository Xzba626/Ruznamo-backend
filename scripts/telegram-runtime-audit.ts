/**
 * Safe Telegram production runtime audit.
 * Never prints TELEGRAM_BOT_TOKEN or TELEGRAM_WEBHOOK_SECRET values.
 *
 * Usage:
 *   npx ts-node -P tsconfig.scripts.json scripts/telegram-runtime-audit.ts
 *   npx ts-node -P tsconfig.scripts.json scripts/telegram-runtime-audit.ts --register-webhook
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

function loadEnvFile(): void {
  const envPath = resolve(__dirname, '../.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadEnvFile();

const PRODUCTION_WEBHOOK_URL =
  process.env.TELEGRAM_WEBHOOK_URL?.trim() ||
  'https://ruznamo-backend-o4xk.vercel.app/api/v1/telegram/webhook';

const DEPRECATED_ENV = [
  'TELEGRAM_USER_BOT_TOKEN',
  'TELEGRAM_ADMIN_BOT_TOKEN',
  'ADMIN_TELEGRAM_CHAT_ID',
] as const;

const REQUIRED_ENV = [
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_WEBHOOK_SECRET',
  'TELEGRAM_BOT_USERNAME',
] as const;

const OPTIONAL_ENV = ['ADMIN_TELEGRAM_IDS', 'TELEGRAM_WEBHOOK_URL'] as const;

function mask(value: string | undefined): string {
  if (!value?.trim()) return 'missing';
  const v = value.trim();
  if (v.length <= 8) return 'configured (short)';
  return `configured (${v.slice(0, 4)}…${v.slice(-4)}, len=${v.length})`;
}

async function telegramApi<T>(token: string, method: string, body?: Record<string, unknown>): Promise<{
  ok: boolean;
  status: number;
  result?: T;
  description?: string;
}> {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = (await response.json()) as {
    ok: boolean;
    result?: T;
    description?: string;
  };

  return {
    ok: json.ok,
    status: response.status,
    result: json.result,
    description: json.description,
  };
}

interface WebhookInfo {
  url: string;
  has_custom_certificate: boolean;
  pending_update_count: number;
  last_error_date?: number;
  last_error_message?: string;
  max_connections?: number;
  allowed_updates?: string[];
}

interface BotMe {
  id: number;
  is_bot: boolean;
  first_name: string;
  username?: string;
  can_join_groups?: boolean;
  can_read_all_group_messages?: boolean;
  supports_inline_queries?: boolean;
}

async function probeProductionWebhook(secret: string | undefined): Promise<void> {
  console.log('\n=== Production webhook endpoint probe ===');
  const res = await fetch(PRODUCTION_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ update_id: 0 }),
  });
  const text = await res.text();
  console.log(`POST ${PRODUCTION_WEBHOOK_URL}`);
  console.log(`  status: ${res.status}`);
  console.log(`  body: ${text.slice(0, 200)}`);
  if (secret) {
    const okRes = await fetch(PRODUCTION_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-telegram-bot-api-secret-token': secret,
      },
      body: JSON.stringify({ update_id: 0 }),
    });
    const okText = await okRes.text();
    console.log(`  with secret header: ${okRes.status} ${okText.slice(0, 120)}`);
  }
}

async function main(): Promise<void> {
  const registerWebhook = process.argv.includes('--register-webhook');

  console.log('=== ENV audit (masked) ===');
  for (const key of REQUIRED_ENV) {
    console.log(`  ${key}: ${mask(process.env[key])}`);
  }
  for (const key of OPTIONAL_ENV) {
    console.log(`  ${key}: ${mask(process.env[key])}`);
  }
  for (const key of DEPRECATED_ENV) {
    const val = process.env[key];
    if (val?.trim()) {
      console.log(`  ⚠ ${key}: DEPRECATED but SET — backend ignores this name`);
    } else {
      console.log(`  ${key}: empty (deprecated, ignored)`);
    }
  }

  const token =
    (process.env.TELEGRAM_BOT_TOKEN ?? '').trim() ||
    (process.env.TELEGRAM_USER_BOT_TOKEN ?? '').trim() ||
    (process.env.TELEGRAM_ADMIN_BOT_TOKEN ?? '').trim();
  const secret = (process.env.TELEGRAM_WEBHOOK_SECRET ?? '').trim();

  if (!process.env.TELEGRAM_BOT_TOKEN?.trim() && token) {
    console.log('\n⚠ Using deprecated token env name. Set TELEGRAM_BOT_TOKEN.');
  }

  if (!token) {
    console.log('\n❌ TELEGRAM_BOT_TOKEN missing locally — cannot call getMe/getWebhookInfo.');
    console.log('   Set TELEGRAM_BOT_TOKEN in .env (not TELEGRAM_USER_BOT_TOKEN) and re-run.');
    await probeProductionWebhook(secret || undefined);
    return;
  }

  console.log('\n=== getMe ===');
  const me = await telegramApi<BotMe>(token, 'getMe');
  if (!me.ok || !me.result) {
    console.log(`  FAIL status=${me.status} description=${me.description ?? 'unknown'}`);
  } else {
    console.log(`  ok: true`);
    console.log(`  bot id: ${me.result.id}`);
    console.log(`  username: @${me.result.username ?? '—'}`);
    console.log(`  first_name: ${me.result.first_name}`);
    console.log(`  can_join_groups: ${me.result.can_join_groups}`);
    console.log(`  supports_inline_queries: ${me.result.supports_inline_queries}`);
  }

  console.log('\n=== getWebhookInfo (before) ===');
  const whBefore = await telegramApi<WebhookInfo>(token, 'getWebhookInfo');
  if (!whBefore.ok || !whBefore.result) {
    console.log(`  FAIL status=${whBefore.status} description=${whBefore.description ?? 'unknown'}`);
  } else {
    const info = whBefore.result;
    console.log(`  url: ${info.url || '(empty — NOT REGISTERED)'}`);
    console.log(`  pending_update_count: ${info.pending_update_count}`);
    console.log(`  last_error_message: ${info.last_error_message ?? 'null'}`);
    console.log(`  max_connections: ${info.max_connections ?? 'default'}`);
    console.log(`  allowed_updates: ${JSON.stringify(info.allowed_updates ?? [])}`);
  }

  if (registerWebhook) {
    if (!secret || secret.length < 16) {
      console.log('\n❌ Cannot register webhook: TELEGRAM_WEBHOOK_SECRET must be at least 16 chars.');
      process.exitCode = 1;
      return;
    }

    console.log('\n=== setWebhook ===');
    const setResult = await telegramApi<boolean>(token, 'setWebhook', {
      url: PRODUCTION_WEBHOOK_URL,
      secret_token: secret,
      allowed_updates: ['message', 'callback_query'],
      drop_pending_updates: false,
    });
    console.log(`  ok: ${setResult.ok} status=${setResult.status} description=${setResult.description ?? '—'}`);

    console.log('\n=== getWebhookInfo (after) ===');
    const whAfter = await telegramApi<WebhookInfo>(token, 'getWebhookInfo');
    if (whAfter.result) {
      console.log(`  url: ${whAfter.result.url || '(empty)'}`);
      console.log(`  last_error_message: ${whAfter.result.last_error_message ?? 'null'}`);
    }
  } else {
    console.log('\nTip: pass --register-webhook to call setWebhook after audit.');
  }

  await probeProductionWebhook(secret || undefined);

  const appConfigRes = await fetch('https://ruznamo-backend-o4xk.vercel.app/api/v1/app/config');
  const appConfig = (await appConfigRes.json()) as { data?: { telegramBotUsername?: string | null } };
  console.log('\n=== Production GET /api/v1/app/config ===');
  console.log(`  telegramBotUsername: ${appConfig.data?.telegramBotUsername ?? 'null'}`);
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
