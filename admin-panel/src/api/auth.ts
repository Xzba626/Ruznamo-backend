import { apiRequest, tokenStore } from './client';
import type { AdminProfile, AuthTokens } from './types';

export async function login(username: string, password: string) {
  const data = await apiRequest<{ tokens: AuthTokens; admin: AdminProfile }>(
    '/api/v1/admin/auth/login',
    { method: 'POST', body: JSON.stringify({ username, password }) },
    false,
  );
  tokenStore.setTokens(data.tokens.accessToken, data.tokens.refreshToken);
  return data.admin;
}

export async function fetchMe() {
  return apiRequest<AdminProfile>('/api/v1/admin/auth/me');
}

export async function logout(refreshToken?: string) {
  await apiRequest<void>('/api/v1/admin/auth/logout', {
    method: 'POST',
    body: JSON.stringify({ refreshToken: refreshToken ?? tokenStore.getRefresh() }),
  });
  tokenStore.clear();
}

export async function changePassword(currentPassword: string, newPassword: string) {
  await apiRequest<void>('/api/v1/admin/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  tokenStore.clear();
}

export async function updateProfile(displayName: string) {
  return apiRequest<import('./types').AdminProfile>('/api/v1/admin/auth/me', {
    method: 'PATCH',
    body: JSON.stringify({ displayName }),
  });
}

export async function fetchSessions(refreshToken?: string) {
  const q = refreshToken ? `?refreshToken=${encodeURIComponent(refreshToken)}` : '';
  return apiRequest<
    Array<{
      id: string;
      createdAt: string;
      expiresAt: string;
      userAgent: string | null;
      ipAddress: string | null;
      isCurrent: boolean;
    }>
  >(`/api/v1/admin/auth/sessions${q}`);
}

export async function revokeOtherSessions(refreshToken?: string) {
  const data = await apiRequest<{ revoked: number }>('/api/v1/admin/auth/sessions/revoke-others', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  });
  return data.revoked;
}
