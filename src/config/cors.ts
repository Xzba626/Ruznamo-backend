/**
 * CORS for admin panel: production + Vercel preview URLs (*.vercel.app under admin-panel*).
 */
export function isAllowedCorsOrigin(origin: string, allowedFromEnv: string[]): boolean {
  const trimmed = origin.trim();
  if (!trimmed) {
    return true;
  }

  if (allowedFromEnv.includes('*')) {
    return true;
  }

  if (allowedFromEnv.includes(trimmed)) {
    return true;
  }

  return isAdminPanelVercelOrigin(trimmed);
}

export function isAdminPanelVercelOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    if (url.protocol !== 'https:' || !url.hostname.endsWith('.vercel.app')) {
      return false;
    }
    return url.hostname === 'admin-panel.vercel.app' || url.hostname.startsWith('admin-panel');
  } catch {
    return false;
  }
}
