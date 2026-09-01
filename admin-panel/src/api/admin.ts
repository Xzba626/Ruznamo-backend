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
    checkedAt: string;
    backend: { status: string; version: string; buildId: string | null; environment: string };
    database: { status: string; reachable: boolean; migrationCount: number; legacyState: string };
    readiness: { status: string; legacyState: string };
    android: {
      status: string;
      configuredLatestVersion: string | null;
      minimumSupportedVersion: string | null;
      forceUpdate: boolean;
      note: string;
      deviceVersionDistribution: Array<{ appVersion: string; count: number }>;
    };
    telegram: {
      status: string;
      enabled: boolean;
      misconfigured: boolean;
      botUsername: string | null;
      webhook: { status: string; lastError: string | null; pendingUpdateCount?: number; url?: string | null };
    };
    adminPanel: { status: string; note: string };
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

export function fetchOrder(orderId: string) {
  return apiRequest<Record<string, unknown>>(`/api/v1/admin/orders/${orderId}`);
}

export function fetchAnalyticsOverview() {
  return apiRequest<{
    definitions: Record<string, string>;
    totals: {
      devices: number;
      activeDevices: number;
      trialUsers: number;
      activeLicenses: number;
      paidUsers: number;
      users: number;
    };
    trends30d: { newInstallations: number; licenseActivations: number; orders: number };
    ordersByStatus: Array<{ status: string; count: number }>;
    planDistribution: Array<{ planCode: string; planName: string; count: number }>;
    categoryDistribution: Array<{ category: string; count: number; percentage: number }>;
    appVersionDistribution: Array<{ appVersion: string; count: number }>;
    generatedAt: string;
  }>('/api/v1/admin/analytics/overview');
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

export type AdminPlan = {
  id: string;
  code: string;
  name: string;
  nameTj: string | null;
  isActive: boolean;
  sortOrder: number;
  licenseCount: number;
  orderCount: number;
  prices: Array<{
    id: string;
    billingPeriod: 'MONTHLY' | 'YEARLY';
    amount: string;
    currency: string;
    isActive: boolean;
  }>;
};

export function fetchPlans() {
  return apiRequest<AdminPlan[]>('/api/v1/admin/plans');
}

export function updatePlan(
  code: string,
  body: {
    isActive?: boolean;
    prices?: Array<{ billingPeriod: 'MONTHLY' | 'YEARLY'; amount: string }>;
  },
) {
  return apiRequest<AdminPlan[]>(`/api/v1/admin/plans/${code}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}
