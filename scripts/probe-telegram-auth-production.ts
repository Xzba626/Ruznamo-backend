/**
 * Production smoke: Telegram auth challenge + schema tables.
 * Safe probe — registers ephemeral device, creates challenge, does NOT log secrets.
 */
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';

const BASE = process.env.PROBE_BASE_URL ?? 'https://ruznamo-backend-o4xk.vercel.app';

async function main() {
  const prisma = new PrismaClient();

  const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('TelegramAuthChallenge', 'TelegramRecoveryGrant')
    ORDER BY table_name
  `;
  console.log('SCHEMA_TABLES', tables.map((t) => t.table_name).join(','));

  const installId = randomUUID();
  const regRes = await fetch(`${BASE}/api/v1/auth/device/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      installationId: installId,
      platform: 'ANDROID',
      appVersion: 'probe-telegram-auth',
      deviceName: 'AuthProbeDevice',
    }),
  });
  const regBody = (await regRes.json()) as {
    tokens?: { accessToken?: string };
    data?: { tokens?: { accessToken?: string } };
  };
  const accessToken =
    regBody.tokens?.accessToken ?? regBody.data?.tokens?.accessToken ?? null;

  if (!accessToken) {
    console.error('REGISTER_FAIL', regRes.status, JSON.stringify(regBody).slice(0, 200));
    process.exit(1);
  }

  const challengeRes = await fetch(`${BASE}/api/v1/auth/telegram/challenge`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ purpose: 'LOGIN' }),
  });
  const challengeBody = (await challengeRes.json()) as {
    challengeId?: string;
    deepLink?: string;
    expiresAt?: string;
    data?: { challengeId?: string; deepLink?: string; expiresAt?: string };
  };

  const payload = challengeBody.data ?? challengeBody;
  const deepLink = payload.deepLink ?? '';

  console.log('CHALLENGE_STATUS', challengeRes.status);
  console.log('CHALLENGE_ID', payload.challengeId ? '[present]' : '[missing]');
  console.log('DEEP_LINK_BOT', deepLink.includes('Ruznamo_bot') || deepLink.includes('ruznamo_bot'));
  console.log('DEEP_LINK_AUTH_PREFIX', deepLink.includes('auth_'));
  console.log('EXPIRES_AT', payload.expiresAt ? '[present]' : '[missing]');

  if (challengeRes.status < 200 || challengeRes.status >= 300) {
    console.error('CHALLENGE_FAIL_BODY', JSON.stringify(challengeBody).slice(0, 300));
    process.exit(1);
  }

  // IDOR probe: grant from device A must not work on device B
  const installId2 = randomUUID();
  const reg2 = await fetch(`${BASE}/api/v1/auth/device/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      installationId: installId2,
      platform: 'ANDROID',
      appVersion: 'probe-telegram-auth-b',
      deviceName: 'AuthProbeDeviceB',
    }),
  });
  const reg2Body = (await reg2.json()) as {
    tokens?: { accessToken?: string };
    data?: { tokens?: { accessToken?: string } };
  };
  const tokenB =
    reg2Body.tokens?.accessToken ?? reg2Body.data?.tokens?.accessToken ?? null;

  if (tokenB) {
    const fakeGrantId = 'c' + '0'.repeat(24);
    const idorRes = await fetch(`${BASE}/api/v1/licenses/recovery/licenses?recoveryGrantId=${fakeGrantId}`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    console.log('IDOR_FAKE_GRANT_STATUS', idorRes.status);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
