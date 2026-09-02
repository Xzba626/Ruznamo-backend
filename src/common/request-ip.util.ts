import type { Request } from 'express';

/**
 * Derives client IP from trusted platform headers (Vercel / reverse proxy).
 * Never trust client-supplied JSON "ip" fields.
 */
export function resolveClientIp(req: Pick<Request, 'headers' | 'ip'>): string | undefined {
  const vercelForwarded = req.headers['x-vercel-forwarded-for'];
  if (typeof vercelForwarded === 'string' && vercelForwarded.trim()) {
    return vercelForwarded.split(',')[0]?.trim() || undefined;
  }

  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0]?.trim() || undefined;
  }

  if (req.ip && req.ip !== '::1' && req.ip !== '127.0.0.1') {
    return req.ip;
  }

  return undefined;
}

export function requestMeta(req: Request): { ipAddress?: string; userAgent?: string } {
  return {
    ipAddress: resolveClientIp(req),
    userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
  };
}
