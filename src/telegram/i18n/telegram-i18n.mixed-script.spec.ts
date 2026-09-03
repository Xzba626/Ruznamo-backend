import { ru } from './ru';
import { tj } from './tj';
import type { TelegramI18n } from './telegram-i18n.types';

/** Cyrillic letter immediately adjacent to Latin letter inside a token (e.g. барқaror). */
const MIXED_SCRIPT_TOKEN = /[\u0400-\u04FF][A-Za-z]|[A-Za-z][\u0400-\u04FF]/;

const ALLOWED_LATIN_FRAGMENTS = new Set([
  'Standard',
  'Pro',
  'Pro Plus',
  'Ruznamo',
  'Telegram',
  'PDF',
  'OTP',
  'Android',
  'Huawei',
  'APK',
  'ID',
  'OK',
  'VIP',
]);

function collectStrings(value: unknown, path: string, out: Array<{ path: string; text: string }>): void {
  if (typeof value === 'string') {
    out.push({ path, text: value });
    return;
  }
  if (typeof value === 'function') {
    try {
      const sample = value(
        'X',
        'Y',
        'Z',
        '1',
        '2',
        '3',
        '4',
        '5',
        '6',
        '7',
        '8',
        '9',
        '10',
      );
      if (typeof sample === 'string') {
        out.push({ path, text: sample });
      }
    } catch {
      // skip functions that need structured args
    }
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      collectStrings(child, path ? `${path}.${key}` : key, out);
    }
  }
}

function findMixedScriptHits(dict: TelegramI18n, lang: string): string[] {
  const entries: Array<{ path: string; text: string }> = [];
  collectStrings(dict, '', entries);
  const hits: string[] = [];
  for (const { path, text } of entries) {
    // Whitelist whole known product Latin tokens by temporarily masking them
    let masked = text;
    for (const allowed of ALLOWED_LATIN_FRAGMENTS) {
      masked = masked.split(allowed).join('□'.repeat(allowed.length));
    }
    if (MIXED_SCRIPT_TOKEN.test(masked)) {
      hits.push(`${lang}:${path}: ${text.slice(0, 120)}`);
    }
  }
  return hits;
}

describe('Telegram i18n mixed-script detector', () => {
  it('RU dictionary has no mixed Cyrillic+Latin tokens (except allowed product names)', () => {
    expect(findMixedScriptHits(ru, 'ru')).toEqual([]);
  });

  it('TJ dictionary has no mixed Cyrillic+Latin tokens (except allowed product names)', () => {
    expect(findMixedScriptHits(tj, 'tj')).toEqual([]);
  });
});
