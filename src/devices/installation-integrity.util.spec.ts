import { UserCategory } from '@prisma/client';
import {
  classifyInstallationAccess,
  evaluateInstallationIntegrity,
} from './installation-integrity.util';
import { resolveUserCategory } from './resolve-user-category.util';

describe('resolveUserCategory', () => {
  it('maps backend enum and local role ids', () => {
    expect(resolveUserCategory('TEACHER', null)).toBe(UserCategory.TEACHER);
    expect(resolveUserCategory(null, 'teacher')).toBe(UserCategory.TEACHER);
    expect(resolveUserCategory(null, 'lecturer')).toBe(UserCategory.LECTURER);
    expect(resolveUserCategory(null, 'other')).toBe(UserCategory.PERSONAL);
    expect(resolveUserCategory(undefined, 'unknown-role')).toBeUndefined();
  });
});

describe('evaluateInstallationIntegrity', () => {
  it('flags LICENSE_STATE_MISMATCH when client ACTIVE and server NONE', () => {
    const result = evaluateInstallationIntegrity({
      clientReportedAccessState: 'ACTIVE',
      serverEffectiveStatus: 'NONE',
    });
    expect(result.status).toBe('REVIEW');
    expect(result.reasons).toContain('LICENSE_STATE_MISMATCH');
  });

  it('stays NORMAL when client and server agree on access', () => {
    const result = evaluateInstallationIntegrity({
      clientReportedAccessState: 'ACTIVE',
      serverEffectiveStatus: 'ACTIVE',
    });
    expect(result.status).toBe('NORMAL');
    expect(result.reasons).toEqual([]);
  });

  it('flags revoked device still claiming access', () => {
    const result = evaluateInstallationIntegrity({
      clientReportedAccessState: 'TRIAL',
      serverEffectiveStatus: 'SUSPENDED',
      deviceRevokedAt: new Date(),
    });
    expect(result.status).toBe('REVIEW');
    expect(result.reasons).toEqual(
      expect.arrayContaining(['DEVICE_REVOKED_IN_USE', 'LICENSE_STATE_MISMATCH']),
    );
  });
});

describe('classifyInstallationAccess', () => {
  it('prefers licensed over trial', () => {
    expect(
      classifyInstallationAccess({
        hasActiveLicenseOnDevice: true,
        hasActiveLicenseOnUser: false,
        trialStatus: 'ACTIVE',
        trialExpiresAt: new Date(Date.now() + 86400000),
      }),
    ).toBe('LICENSED');
  });

  it('detects trial expired', () => {
    expect(
      classifyInstallationAccess({
        hasActiveLicenseOnDevice: false,
        hasActiveLicenseOnUser: false,
        trialStatus: 'EXPIRED',
        trialExpiresAt: new Date(Date.now() - 1000),
      }),
    ).toBe('TRIAL_EXPIRED');
  });
});
