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
    username: string | null;
    firstName: string | null;
    verifiedAt: string | null;
    lastSeenAt: string | null;
  }>('/api/v1/admin/telegram/status');
}

export function startTelegramRebind(currentPassword: string) {
  return apiRequest<{ expiresAt: string; deepLink: string | null; instructions: string }>(
    '/api/v1/admin/telegram/rebind/start',
    { method: 'POST', body: JSON.stringify({ currentPassword }) },
  );
}

export function verifyTelegramRebind(otp: string) {
  return apiRequest<{
    connected: boolean;
    isVerified: boolean;
    telegramUserId: string | null;
    username: string | null;
    verifiedAt: string | null;
  }>('/api/v1/admin/telegram/rebind/verify', {
    method: 'POST',
    body: JSON.stringify({ otp }),
  });
}

export function disconnectTelegramAdmin(currentPassword: string) {
  return apiRequest<{
    connected: boolean;
    isVerified: boolean;
    telegramUserId: string | null;
  }>('/api/v1/admin/telegram/disconnect', {
    method: 'POST',
    body: JSON.stringify({ currentPassword }),
  });
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

export function fetchAnalyticsSales(period: 'today' | '7d' | '30d' | 'month' | 'prev_month' = '30d') {
  return apiRequest<{
    period: string;
    sold: { total: number; byPlan: Array<{ planCode: string; planName: string; count: number }>; byBillingPeriod: { MONTHLY: number; YEARLY: number } };
    manualIssued: number;
    unknownLegacy: number;
    revenue: { grossApproved: string; currency: string };
    activity: { activations: number; activeLicenses: number };
    sourceBreakdown: { telegramPayment: number; adminManual: number; unknownLegacy: number };
    definitions: Record<string, string>;
    generatedAt: string;
  }>(`/api/v1/admin/analytics/sales?period=${period}`);
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

export function createManualLicense(body: {
  planCode: string;
  billingPeriod: string;
  customerLabel?: string;
  adminNote?: string;
  linkTelegramUserId?: string;
}) {
  return apiRequest<{
    id: string;
    licenseKey: string;
    keyPrefix: string;
    expiresAt: string;
    issueSource: string;
    planCode: string;
    billingPeriod: string;
  }>('/api/v1/admin/licenses', {
    method: 'POST',
    body: JSON.stringify(body),
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
  maxDevices?: number | null;
  priceConfigured?: { monthly: boolean; yearly: boolean };
  prices: Array<{
    id: string;
    billingPeriod: 'MONTHLY' | 'YEARLY';
    amount: string;
    currency: string;
    isActive: boolean;
  }>;
};

export type AdminPlansResponse = {
  plans: AdminPlan[];
  missingCanonicalCodes: string[];
};

function normalizePlansResponse(data: AdminPlan[] | AdminPlansResponse): AdminPlansResponse {
  if (Array.isArray(data)) {
    return { plans: data, missingCanonicalCodes: [] };
  }
  return data;
}

export function fetchPlans() {
  return apiRequest<AdminPlan[] | AdminPlansResponse>('/api/v1/admin/plans').then(normalizePlansResponse);
}

export function bootstrapSystemPlans() {
  return apiRequest<AdminPlan[] | AdminPlansResponse>('/api/v1/admin/plans/bootstrap', {
    method: 'POST',
  }).then(normalizePlansResponse);
}

export function updatePlan(
  code: string,
  body: {
    isActive?: boolean;
    prices?: Array<{ billingPeriod: 'MONTHLY' | 'YEARLY'; amount: string }>;
  },
) {
  return apiRequest<AdminPlan[] | AdminPlansResponse>(`/api/v1/admin/plans/${code}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  }).then(normalizePlansResponse);
}

export function fetchResetPasswordStatus() {
  return apiRequest<{ configured: boolean; passwordChangedAt: string | null }>(
    '/api/v1/admin/system/data-reset/password-status',
  );
}

export function initializeResetPassword(body: { newPassword: string; confirmPassword: string }) {
  return apiRequest('/api/v1/admin/system/data-reset/password/initialize', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function changeResetPassword(body: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}) {
  return apiRequest('/api/v1/admin/system/data-reset/password/change', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function dataResetDryRun(scope: string) {
  return apiRequest<{
    scope: string;
    dryRun: boolean;
    counts: Record<string, number>;
    preserved?: string[];
    samples?: Array<{ table: string; id: string; reason: string; label?: string }>;
    generatedAt?: string;
    additionalImpact?: Record<string, string>;
    previewId?: string;
    previewExpiresAt?: string;
    confirmationPhrase?: string;
  }>('/api/v1/admin/system/data-reset/dry-run', {
    method: 'POST',
    body: JSON.stringify({ scope }),
  });
}

export function executeDataReset(body: {
  scope: string;
  resetPassword: string;
  confirmationPhrase: string;
  previewId: string;
}) {
  return apiRequest<{ afterCounts: Record<string, number> }>(
    '/api/v1/admin/system/data-reset/execute',
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
  );
}

export function fetchReleasesOverview() {
  return apiRequest<{
    storageConfigured: boolean;
    signingConfigured: boolean;
    storageProvider?: string;
    functionApkProxy?: boolean;
    current: {
      id: string;
      versionLabel: string;
      versionName: string;
      versionCode: number;
      packageName: string;
      signingCertificateSha256: string;
      fileSize: number;
      sha256: string;
      publishedAt: string | null;
      adoption: { count: number; percent: number };
    } | null;
    history: Array<{
      id: string;
      versionLabel: string;
      versionName: string;
      versionCode: number;
      status: string;
      fileSize: number;
      deviceCount?: number;
      publishedAt: string | null;
      signingCertificateSha256?: string;
      packageName?: string;
      sha256?: string;
    }>;
  }>('/api/v1/admin/releases');
}

export type DraftRelease = {
  id: string;
  versionLabel?: string;
  versionName: string;
  versionCode: number;
  packageName: string;
  signingCertificateSha256: string;
  fileSize: number;
  sha256: string;
  status: string;
};

export function requestReleaseUploadAuthorization(fileSize: number) {
  return apiRequest<{
    uploadId: string;
    pathname: string;
    uploadUrl: string;
    method: 'PUT';
    headers: Record<string, string>;
    expiresAt: string;
    provider: string;
  }>('/api/v1/admin/releases/upload-authorization', {
    method: 'POST',
    body: JSON.stringify({ fileSize }),
  });
}

export function finalizeReleaseUpload(uploadId: string) {
  return apiRequest<DraftRelease>('/api/v1/admin/releases/finalize', {
    method: 'POST',
    body: JSON.stringify({ uploadId }),
  });
}

export function deleteDraftRelease(id: string) {
  return apiRequest<{ deleted: boolean; id: string }>(`/api/v1/admin/releases/${id}`, {
    method: 'DELETE',
  });
}

/** Direct browser → Blob PUT. Never send APK bytes to the Nest function. */
export function uploadApkToBlob(
  uploadUrl: string,
  file: File,
  headers: Record<string, string>,
  onProgress?: (loaded: number, total: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl);
    Object.entries(headers).forEach(([key, value]) => xhr.setRequestHeader(key, value));
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress?.(event.loaded, event.total);
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }
      reject(new Error('Не удалось загрузить APK.'));
    };
    xhr.onerror = () => reject(new Error('Не удалось загрузить APK.'));
    xhr.send(file);
  });
}

export function updateReleaseDraft(
  id: string,
  body: { changelogRu?: string; changelogTg?: string; mandatory?: boolean },
) {
  return apiRequest(`/api/v1/admin/releases/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export function publishRelease(id: string) {
  return apiRequest(`/api/v1/admin/releases/${id}/publish`, { method: 'POST', body: JSON.stringify({}) });
}
