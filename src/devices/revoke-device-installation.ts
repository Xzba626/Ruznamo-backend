import type { Prisma } from '@prisma/client';

type RevokeTx = Pick<Prisma.TransactionClient, 'deviceInstallation' | 'refreshToken'>;

/** Revoke a device installation and invalidate its refresh sessions atomically. */
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
