import { assertPrivacyContentReady, sanitizePrivacyContent } from './privacy-content.util';

describe('privacy-content.util', () => {
  it('strips HTML and scripts', () => {
    const raw = '<p>Hello</p><script>alert(1)</script>## Title\nSafe';
    const cleaned = sanitizePrivacyContent(raw);
    expect(cleaned).not.toContain('<script');
    expect(cleaned).not.toContain('<p>');
    expect(cleaned).toContain('## Title');
    expect(cleaned).toContain('Safe');
  });

  it('requires both locales for publish', () => {
    expect(assertPrivacyContentReady('ru', '').missing).toEqual(['TJ']);
    expect(assertPrivacyContentReady('', 'tj').missing).toEqual(['RU']);
    expect(assertPrivacyContentReady('ru', 'tj').ok).toBe(true);
  });
});
