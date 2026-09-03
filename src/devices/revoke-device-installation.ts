import type { Prisma } from '@prisma/client';

type RevokeTx = Pick<Prisma.TransactionClient, 'deviceInstallation' | 'refreshToken'>;

/**
 * GLOBAL installation block — sets DeviceInstallation.revokedAt.
 *
 * Reserved for explicit security/admin block of an installation identity.
 * MUST NOT be used for:
 * - holder disconnect (soft-revoke LicenseActivation only)
 * - license replacement
 * - mobile "remove device" / logout / slot clear
 * - Telegram recovery
 *
 * Current production call sites that SET DeviceInstallation.revokedAt:
 * NONE (helper retained for a future explicit admin block API).
 */
export async function revokeDeviceInstallation(
  tx: RevokeTx,
  deviceId: string,
  revokedAt: Date,
): Promise<void> {
  await tx.deviceInstallation.update({
    where: { id: deviceId },
    data: { revokedAt },
  });
  await tx.refreshToken.updateMany({
    where: { deviceId, revokedAt: null },
    data: { revokedAt },
  });
}
