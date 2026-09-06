/**
 * License integrity risk signals for Admin.
 * Client-reported state is never authoritative — flags are review hints only.
 */

export type IntegrityStatus = 'NORMAL' | 'REVIEW';

export type IntegrityReasonCode =
  | 'LICENSE_STATE_MISMATCH'
  | 'REVOKED_LICENSE_IN_USE'
  | 'DEVICE_REVOKED_IN_USE';

/** Normalized client UX claims that imply "I have access". */
const CLIENT_ACTIVE_CLAIMS = new Set([
  'ACTIVE',
  'LICENSED',
  'PREMIUM',
  'UNLOCKED',
  'TRIAL',
]);

export function normalizeClientAccessState(raw?: string | null): string | null {
  if (!raw?.trim()) return null;
  return raw.trim().toUpperCase().replace(/-/g, '_');
}

export function clientClaimsAccess(normalized: string | null): boolean {
  if (!normalized) return false;
  return CLIENT_ACTIVE_CLAIMS.has(normalized);
}

export interface IntegrityInput {
  clientReportedAccessState?: string | null;
  serverEffectiveStatus: 'ACTIVE' | 'TRIAL' | 'EXPIRED' | 'SUSPENDED' | 'NONE';
  deviceRevokedAt?: Date | null;
  licenseStatus?: string | null;
}

export interface IntegrityResult {
  status: IntegrityStatus;
  reasons: IntegrityReasonCode[];
}

export function evaluateInstallationIntegrity(input: IntegrityInput): IntegrityResult {
  const reasons: IntegrityReasonCode[] = [];
  const client = normalizeClientAccessState(input.clientReportedAccessState);
  const claimsAccess = clientClaimsAccess(client);

  if (input.deviceRevokedAt && claimsAccess) {
    reasons.push('DEVICE_REVOKED_IN_USE');
  }

  if (
    input.licenseStatus &&
    ['REVOKED', 'SUSPENDED'].includes(input.licenseStatus.toUpperCase()) &&
    claimsAccess
  ) {
    reasons.push('REVOKED_LICENSE_IN_USE');
  }

  const serverDenied = ['EXPIRED', 'NONE', 'SUSPENDED'].includes(input.serverEffectiveStatus);
  if (claimsAccess && serverDenied) {
    // Client TRIAL while server NONE/EXPIRED is still a mismatch worth review.
    reasons.push('LICENSE_STATE_MISMATCH');
  }

  // Deduplicate while preserving order
  const unique = [...new Set(reasons)];
  return {
    status: unique.length > 0 ? 'REVIEW' : 'NORMAL',
    reasons: unique,
  };
}

/** Coarse server-side license bucket for Admin aggregates (by installation). */
export type InstallationAccessBucket =
  | 'LICENSED'
  | 'TRIAL'
  | 'TRIAL_EXPIRED'
  | 'NONE'
  | 'REVOKED';

export function classifyInstallationAccess(input: {
  deviceRevokedAt?: Date | null;
  hasActiveLicenseOnDevice: boolean;
  hasActiveLicenseOnUser: boolean;
  trialStatus?: string | null;
  trialExpiresAt?: Date | null;
}): InstallationAccessBucket {
  if (input.deviceRevokedAt) return 'REVOKED';
  if (input.hasActiveLicenseOnDevice || input.hasActiveLicenseOnUser) return 'LICENSED';

  const trial = input.trialStatus?.toUpperCase();
  const trialActive =
    trial === 'ACTIVE' &&
    (!input.trialExpiresAt || input.trialExpiresAt.getTime() > Date.now());
  if (trialActive) return 'TRIAL';

  if (trial === 'EXPIRED' || (trial === 'ACTIVE' && input.trialExpiresAt && input.trialExpiresAt.getTime() <= Date.now())) {
    return 'TRIAL_EXPIRED';
  }

  return 'NONE';
}

export function mapBucketToEffectiveStatus(
  bucket: InstallationAccessBucket,
): 'ACTIVE' | 'TRIAL' | 'EXPIRED' | 'SUSPENDED' | 'NONE' {
  switch (bucket) {
    case 'LICENSED':
      return 'ACTIVE';
    case 'TRIAL':
      return 'TRIAL';
    case 'TRIAL_EXPIRED':
      return 'EXPIRED';
    case 'REVOKED':
      return 'SUSPENDED';
    default:
      return 'NONE';
  }
}
