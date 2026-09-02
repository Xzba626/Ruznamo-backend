import { randomBytes } from 'crypto';

const TOKEN_BYTES = 16;

export function generateOpaqueToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url');
}

export const TELEGRAM_START_PREFIX = {
  LICENSE_LINK: 'lic_',
  DEVICE_REPLACEMENT: 'repl_',
  TELEGRAM_AUTH: 'auth_',
  ANDROID_LICENSE: 'android_license',
  ANDROID_SUPPORT: 'android_support',
} as const;

export function buildLicenseLinkStartPayload(token: string): string {
  return `${TELEGRAM_START_PREFIX.LICENSE_LINK}${token}`;
}

export function buildReplacementStartPayload(token: string): string {
  return `${TELEGRAM_START_PREFIX.DEVICE_REPLACEMENT}${token}`;
}

export function buildAuthStartPayload(token: string): string {
  return `${TELEGRAM_START_PREFIX.TELEGRAM_AUTH}${token}`;
}

export function parseLicenseLinkStartPayload(text: string): string | null {
  const parts = text.trim().split(/\s+/);
  const payload = parts.length > 1 ? parts.slice(1).join(' ') : '';
  if (!payload.startsWith(TELEGRAM_START_PREFIX.LICENSE_LINK)) {
    return null;
  }
  const token = payload.slice(TELEGRAM_START_PREFIX.LICENSE_LINK.length);
  return token.length >= 8 ? token : null;
}

export function parseReplacementStartPayload(text: string): string | null {
  const parts = text.trim().split(/\s+/);
  const payload = parts.length > 1 ? parts.slice(1).join(' ') : '';
  if (!payload.startsWith(TELEGRAM_START_PREFIX.DEVICE_REPLACEMENT)) {
    return null;
  }
  const token = payload.slice(TELEGRAM_START_PREFIX.DEVICE_REPLACEMENT.length);
  return token.length >= 8 ? token : null;
}

export function parseAuthStartPayload(text: string): string | null {
  const parts = text.trim().split(/\s+/);
  const payload = parts.length > 1 ? parts.slice(1).join(' ') : '';
  if (!payload.startsWith(TELEGRAM_START_PREFIX.TELEGRAM_AUTH)) {
    return null;
  }
  const token = payload.slice(TELEGRAM_START_PREFIX.TELEGRAM_AUTH.length);
  return token.length >= 8 ? token : null;
}

export function parseAndroidDeepLink(text: string): 'android_license' | 'android_support' | null {
  const parts = text.trim().split(/\s+/);
  const payload = parts.length > 1 ? parts[1] : '';
  if (payload === TELEGRAM_START_PREFIX.ANDROID_LICENSE) {
    return 'android_license';
  }
  if (payload === TELEGRAM_START_PREFIX.ANDROID_SUPPORT) {
    return 'android_support';
  }
  return null;
}
