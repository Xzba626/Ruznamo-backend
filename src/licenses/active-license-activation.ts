import type { Prisma } from '@prisma/client';

/** Active license slot: activation not soft-revoked AND device not globally blocked. */
export const ACTIVE_LICENSE_ACTIVATION_WHERE: Prisma.LicenseActivationWhereInput = {
  revokedAt: null,
  device: { revokedAt: null },
};

export function activeActivationsForLicense(licenseId: string): Prisma.LicenseActivationWhereInput {
  return {
    licenseId,
    ...ACTIVE_LICENSE_ACTIVATION_WHERE,
  };
}
