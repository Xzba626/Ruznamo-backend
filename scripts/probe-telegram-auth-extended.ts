/**
 * Extended production smoke: challenge → webhook auth_ → wrong OTP → grant checks.
 * Does NOT log OTP, opaque token, recoveryGrantId, or full keys.
 */
import { createHash, randomUUID } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { PrismaClient } from '@prisma/client';

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

const BASE = process.env.PROBE_BASE_URL ?? 'https://ruznamo-backend-o4xk.vercel.app';
const WEBHOOK_URL =
  process.env.TELEGRAM_WEBHOOK_URL?.trim() ||
  `${BASE}/api/v1/telegram/webhook`;
const WEBHOOK_SECRET = (process.env.TELEGRAM_WEBHOOK_SECRET ?? '').trim();
const BOT_TOKEN = (process.env.TELEGRAM_BOT_TOKEN ?? '').trim();

async function registerDevice(label: string): Promise<string> {
  const res = await fetch(`${BASE}/api/v1/auth/device/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      installationId: randomUUID(),
      platform: 'ANDROID',
      appVersion: 'probe-telegram-auth-ext',
      deviceName: label,
    }),
  });
  const body = (await res.json()) as {
    tokens?: { accessToken?: string };
    data?: { tokens?: { accessToken?: string } };
  };
  const token = body.tokens?.accessToken ?? body.data?.tokens?.accessToken;
  if (!token) throw new Error(`register failed: ${res.status}`);
  return token;
}

function extractAuthToken(deepLink: string): string | null {
  const match = deepLink.match(/start=auth_([^&]+)/);
  return match?.[1] ?? null;
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  const out: Record<string, unknown> = {};

  try {
    const tokenA = await registerDevice('AuthProbeExtA');
    const challengeRes = await fetch(`${BASE}/api/v1/auth/telegram/challenge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ purpose: 'RECOVERY' }),
    });
    const challengeBody = (await challengeRes.json()) as {
      challengeId?: string;
      deepLink?: string;
      data?: { challengeId?: string; deepLink?: string };
    };
    const payload = challengeBody.data ?? challengeBody;
    const challengeId = payload.challengeId;
    const deepLink = payload.deepLink ?? '';
    const authToken = extractAuthToken(deepLink);

    out.challengeStatus = challengeRes.status;
    out.challengeIdPresent = Boolean(challengeId);
    out.authTokenPresent = Boolean(authToken);

    if (!WEBHOOK_SECRET || !authToken || !challengeId) {
      out.webhookSkipped = 'missing secret or challenge';
    } else {
      const probeTelegramId = 9_001_002_003n;
      let telegramAccount = await prisma.telegramAccount.findFirst({
        where: { telegramId: probeTelegramId },
      });
      if (!telegramAccount) {
        const user = await prisma.user.create({ data: { displayName: 'AuthProbeUser' } });
        telegramAccount = await prisma.telegramAccount.create({
          data: {
            userId: user.id,
            telegramId: probeTelegramId,
            chatId: probeTelegramId,
            username: 'auth_probe_holder',
            firstName: 'AuthProbe',
          },
        });
      }

      const updateId = 9_100_000_000 + Math.floor(Date.now() / 1000) % 100_000_000;
      const webhookRes = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-telegram-bot-api-secret-token': WEBHOOK_SECRET,
        },
        body: JSON.stringify({
          update_id: updateId,
          message: {
            message_id: 1,
            date: Math.floor(Date.now() / 1000),
            chat: { id: Number(probeTelegramId), type: 'private' },
            from: {
              id: Number(probeTelegramId),
              is_bot: false,
              first_name: 'AuthProbe',
              username: 'auth_probe_holder',
            },
            text: `/start auth_${authToken}`,
          },
        }),
      });
      out.webhookAuthStartStatus = webhookRes.status;

      const dbChallenge = await prisma.telegramAuthChallenge.findUnique({
        where: { id: challengeId },
        select: {
          telegramAccountId: true,
          otpHash: true,
          otpExpiresAt: true,
          consumedAt: true,
        },
      });
      out.webhookBoundTelegram = Boolean(dbChallenge?.telegramAccountId);
      out.webhookOtpIssued = Boolean(dbChallenge?.otpHash && dbChallenge.otpExpiresAt);

      const wrongOtpRes = await fetch(`${BASE}/api/v1/auth/telegram/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({ challengeId, code: '000000' }),
      });
      const wrongBody = (await wrongOtpRes.json()) as { error?: { code?: string }; code?: string };
      const wrongCode =
        wrongBody.error?.code ??
        (typeof wrongBody === 'object' && 'code' in wrongBody ? String(wrongBody.code) : undefined);
      out.wrongOtpStatus = wrongOtpRes.status;
      out.wrongOtpCode = wrongCode;

      const tokenB = await registerDevice('AuthProbeExtB');
      const fakeGrant = createHash('sha256').update(`fake-${Date.now()}`).digest('hex').slice(0, 25);
      const idorList = await fetch(
        `${BASE}/api/v1/licenses/recovery/licenses?recoveryGrantId=${fakeGrant}`,
        { headers: { Authorization: `Bearer ${tokenB}` } },
      );
      out.idorFakeGrantListStatus = idorList.status;

      const replayWebhook = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-telegram-bot-api-secret-token': WEBHOOK_SECRET,
        },
        body: JSON.stringify({
          update_id: updateId + 1,
          message: {
            message_id: 2,
            date: Math.floor(Date.now() / 1000),
            chat: { id: Number(probeTelegramId), type: 'private' },
            from: {
              id: Number(probeTelegramId),
              is_bot: false,
              first_name: 'AuthProbe',
            },
            text: `/start auth_${authToken}`,
          },
        }),
      });
      out.replayWebhookStatus = replayWebhook.status;
    }

    if (BOT_TOKEN) {
      const wh = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`);
      const whBody = (await wh.json()) as {
        ok?: boolean;
        result?: { url?: string; last_error_message?: string | null; pending_update_count?: number };
      };
      out.telegramWebhookOk = whBody.ok === true;
      out.telegramWebhookUrlSet = Boolean(whBody.result?.url);
      out.telegramLastError = whBody.result?.last_error_message ?? null;
      out.telegramPendingUpdates = whBody.result?.pending_update_count ?? null;
    }

    out.deploySha = '09fca16';
    out.remoteEndpoint = BASE;
    console.log(JSON.stringify(out, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((err) => {
  console.error(String(err));
  process.exit(1);
});
