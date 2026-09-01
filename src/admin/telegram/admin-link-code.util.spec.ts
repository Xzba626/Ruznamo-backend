import {
  extractAdminLinkCodeFromStart,
  isAdminLinkCodeMessage,
  normalizeAdminLinkCode,
} from './admin-link-code.util';

describe('admin-link-code.util', () => {
  it('normalizes full RZ code', () => {
    expect(normalizeAdminLinkCode('rz-abc123')).toBe('RZ-ABC123');
  });

  it('normalizes hex without prefix', () => {
    expect(normalizeAdminLinkCode('ABC123')).toBe('RZ-ABC123');
  });

  it('extracts code from /start', () => {
    expect(extractAdminLinkCodeFromStart('/start RZ-ABC123')).toBe('RZ-ABC123');
  });

  it('detects admin link code messages', () => {
    expect(isAdminLinkCodeMessage('RZ-ABC123')).toBe(true);
    expect(isAdminLinkCodeMessage('hello')).toBe(false);
  });
});
