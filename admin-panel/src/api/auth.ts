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
