/** Admin panel pairing codes: RZ- + 6 hex chars (e.g. RZ-A1B2C3). */
const ADMIN_LINK_CODE_PATTERN = /^RZ-[A-F0-9]{6}$/i;

export function normalizeAdminLinkCode(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  const upper = trimmed.toUpperCase();
  if (ADMIN_LINK_CODE_PATTERN.test(upper)) {
    return upper;
  }

  const withoutPrefix = trimmed.replace(/^RZ[-\s]?/i, '').replace(/\s+/g, '');
  if (/^[A-F0-9]{6}$/i.test(withoutPrefix)) {
    return `RZ-${withoutPrefix.toUpperCase()}`;
  }

  return null;
}

export function isAdminLinkCodeMessage(text: string): boolean {
  return normalizeAdminLinkCode(text) !== null;
}

export function extractAdminLinkCodeFromStart(text: string): string | null {
  const parts = text.trim().split(/\s+/);
  if (!parts[0]?.startsWith('/start') || !parts[1]) {
    return null;
  }
  const payload = parts[1];
  if (payload.startsWith('admin_link_')) {
    return null;
  }
  return normalizeAdminLinkCode(payload);
}

/** Opaque token from `/start admin_link_<token>` deep link (Telegram admin rebind). */
export function extractAdminRebindTokenFromStart(text: string): string | null {
  const parts = text.trim().split(/\s+/);
  if (!parts[0]?.startsWith('/start') || !parts[1]) {
    return null;
  }
  const payload = parts[1];
  if (!payload.startsWith('admin_link_')) {
    return null;
  }
  const token = payload.slice('admin_link_'.length).trim();
  return token.length >= 16 ? token : null;
}
