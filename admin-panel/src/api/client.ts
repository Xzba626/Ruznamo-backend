import type { ApiErrorBody, ApiSuccess } from './types';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

type TokenStore = {
  getAccess: () => string | null;
  getRefresh: () => string | null;
  setTokens: (access: string, refresh: string) => void;
  clear: () => void;
};

export const tokenStore: TokenStore = {
  getAccess: () => sessionStorage.getItem('admin_access'),
  getRefresh: () => sessionStorage.getItem('admin_refresh'),
  setTokens: (access, refresh) => {
    sessionStorage.setItem('admin_access', access);
    sessionStorage.setItem('admin_refresh', refresh);
  },
  clear: () => {
    sessionStorage.removeItem('admin_access');
    sessionStorage.removeItem('admin_refresh');
  },
};

let refreshPromise: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  const refresh = tokenStore.getRefresh();
  if (!refresh) return false;

  const res = await fetch(`${API_BASE}/api/v1/admin/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: refresh }),
  });

  if (!res.ok) {
    tokenStore.clear();
    return false;
  }

  const body = (await res.json()) as ApiSuccess<{ tokens: { accessToken: string; refreshToken: string } }>;
  tokenStore.setTokens(body.data.tokens.accessToken, body.data.tokens.refreshToken);
  return true;
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  const access = tokenStore.getAccess();
  if (access) headers.set('Authorization', `Bearer ${access}`);

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401 && retry) {
    if (!refreshPromise) {
      refreshPromise = refreshSession().finally(() => {
        refreshPromise = null;
      });
    }
    const ok = await refreshPromise;
    if (ok) return apiRequest<T>(path, options, false);
    throw new ApiClientError(401, 'UNAUTHORIZED', 'Session expired. Please sign in again.');
  }

  if (res.status === 204) {
    return undefined as T;
  }

  let json: ApiSuccess<T> | ApiErrorBody;
  try {
    json = (await res.json()) as ApiSuccess<T> | ApiErrorBody;
  } catch {
    throw new ApiClientError(
      res.status,
      'SERVER_ERROR',
      res.status >= 500
        ? 'Backend is unavailable (server error). Wait for Vercel redeploy or use local API.'
        : 'Unexpected response from server.',
    );
  }

  if (!res.ok || !('success' in json) || !json.success) {
    const err = json as ApiErrorBody;
    throw new ApiClientError(res.status, err.error?.code ?? 'ERROR', err.error?.message ?? 'Request failed');
  }

  return json.data;
}

export class ApiClientError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
