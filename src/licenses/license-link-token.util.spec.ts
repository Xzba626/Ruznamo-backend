import {
  buildLicenseLinkStartPayload,
  generateOpaqueToken,
  parseAndroidDeepLink,
  parseLicenseLinkStartPayload,
  TELEGRAM_START_PREFIX,
} from './license-link-token.util';

describe('license-link-token.util', () => {
  it('generates opaque tokens', () => {
    const a = generateOpaqueToken();
    const b = generateOpaqueToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(16);
  });

  it('parses license link start payload', () => {
    const token = 'abc12345';
    const text = `/start ${buildLicenseLinkStartPayload(token)}`;
    expect(parseLicenseLinkStartPayload(text)).toBe(token);
  });

  it('parses android deep links', () => {
    expect(parseAndroidDeepLink(`/start ${TELEGRAM_START_PREFIX.ANDROID_LICENSE}`)).toBe('android_license');
    expect(parseAndroidDeepLink(`/start ${TELEGRAM_START_PREFIX.ANDROID_SUPPORT}`)).toBe('android_support');
  });
});
