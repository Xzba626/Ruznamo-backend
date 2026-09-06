const MAX_POLICY_CHARS = 100_000;

/** Strip HTML/scripts; keep plain text + simple markdown headings/lists. */
export function sanitizePrivacyContent(raw: string): string {
  let text = raw.replace(/\r\n/g, '\n');
  text = text.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<\/?[a-z][^>]*>/gi, '');
  text = text.replace(/javascript:/gi, '');
  text = text.replace(/on\w+\s*=/gi, '');
  text = text.replace(/\u0000/g, '');
  text = text.trim();
  if (text.length > MAX_POLICY_CHARS) {
    text = text.slice(0, MAX_POLICY_CHARS);
  }
  return text;
}

export function assertPrivacyContentReady(contentRu: string, contentTg: string): {
  ok: boolean;
  missing: Array<'RU' | 'TJ'>;
} {
  const missing: Array<'RU' | 'TJ'> = [];
  if (!contentRu.trim()) missing.push('RU');
  if (!contentTg.trim()) missing.push('TJ');
  return { ok: missing.length === 0, missing };
}
