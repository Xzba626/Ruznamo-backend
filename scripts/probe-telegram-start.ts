/**
 * Sends a synthetic /start update to production webhook (idempotent update_id).
 * Does not print secrets.
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
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile();

const WEBHOOK_URL =
  process.env.TELEGRAM_WEBHOOK_URL?.trim() ||
  'https://ruznamo-backend-o4xk.vercel.app/api/v1/telegram/webhook';
const secret = (process.env.TELEGRAM_WEBHOOK_SECRET ?? '').trim();

async function main(): Promise<void> {
  if (!secret) {
    console.error('TELEGRAM_WEBHOOK_SECRET missing');
    process.exitCode = 1;
    return;
  }

  const updateId = 9_000_000_000 + Math.floor(Date.now() / 1000) % 1_000_000_000;
  const telegramId = 999_888_777; // synthetic probe user

  const body = {
    update_id: updateId,
    message: {
      message_id: 1,
      date: Math.floor(Date.now() / 1000),
      chat: { id: telegramId, type: 'private' },
      from: {
        id: telegramId,
        is_bot: false,
        first_name: 'RecoveryProbe',
        username: 'recovery_probe_bot_test',
      },
      text: '/start',
    },
  };

  const res = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-telegram-bot-api-secret-token': secret,
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  console.log(
    JSON.stringify(
      {
        updateId,
        status: res.status,
        body: text.slice(0, 300),
        ok: res.ok,
      },
      null,
      2,
    ),
  );

  if (!res.ok) process.exitCode = 1;
}

void main();
