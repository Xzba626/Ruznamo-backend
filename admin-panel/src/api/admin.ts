import { apiRequest } from './client';
import type { Paginated } from './types';

export function fetchDashboardSummary() {
  return apiRequest<{
    users: { total: number; active: number; suspended: number; trial: number };
    licenses: { active: number; expired: number; pending: number };
    devices: { active: number };
    recentActivity: Array<{ id: string; action: string; createdAt: string; actorEmail: string | null }>;
  }>('/api/v1/admin/dashboard/summary');
}

export function fetchUsers(page = 1, search = '') {
  const q = new URLSearchParams({ page: String(page), limit: '20' });
  if (search) q.set('search', search);
  return apiRequest<Paginated<Record<string, unknown>>>(`/api/v1/admin/users?${q}`);
}

export function fetchLicenses(page = 1, search = '') {
  const q = new URLSearchParams({ page: String(page), limit: '20' });
  if (search) q.set('search', search);
  return apiRequest<Paginated<Record<string, unknown>>>(`/api/v1/admin/licenses?${q}`);
}

export function fetchDevices(page = 1, search = '') {
  const q = new URLSearchParams({ page: String(page), limit: '20' });
  if (search) q.set('search', search);
  return apiRequest<Paginated<Record<string, unknown>>>(`/api/v1/admin/devices?${q}`);
}

export function fetchAudit(page = 1) {
  return apiRequest<Paginated<Record<string, unknown>>>(`/api/v1/admin/audit?page=${page}&limit=20`);
}

export function fetchSystemStatus() {
  return apiRequest<{
    api: string;
    database: string;
    readiness: string;
    version: string;
    environment: string;
  }>('/api/v1/admin/system/status');
}

export function fetchTelegramStatus() {
  return apiRequest<{
    connected: boolean;
    isVerified: boolean;
    telegramUserId: string | null;
    verifiedAt: string | null;
  }>('/api/v1/admin/telegram/status');
}

export function createTelegramConnect() {
  return apiRequest<{ code: string; expiresAt: string; deepLink: string | null; instructions: string }>(
    '/api/v1/admin/telegram/connect',
    { method: 'POST' },
  );
}

export function fetchOrders(page = 1, search = '') {
  const q = new URLSearchParams({ page: String(page), limit: '20' });
  if (search) q.set('search', search);
  return apiRequest<Paginated<Record<string, unknown>>>(`/api/v1/admin/orders?${q}`);
}

export function approveOrder(orderId: string) {
  return apiRequest<{ orderId: string; status: string }>(`/api/v1/admin/orders/${orderId}/approve`, {
    method: 'PATCH',
    body: JSON.stringify({}),
  });
}

export function rejectOrder(orderId: string, reason?: string) {
  return apiRequest<{ orderId: string; status: string }>(`/api/v1/admin/orders/${orderId}/reject`, {
    method: 'PATCH',
    body: JSON.stringify({ reason }),
  });
}

export function revokeLicense(licenseId: string) {
  return apiRequest(`/api/v1/admin/licenses/${licenseId}/revoke`, {
    method: 'PATCH',
    body: JSON.stringify({}),
  });
}
