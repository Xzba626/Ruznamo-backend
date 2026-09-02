/**
 * Production-safe dry run for USER_DATA_RESET counts.
 * Does NOT mutate data.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const [
    users,
    devices,
    telegramAccounts,
    licenses,
    activations,
    orders,
    receipts,
    supportConversations,
    recoverySessions,
    refreshTokens,
    trialGrants,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.deviceInstallation.count(),
    prisma.telegramAccount.count(),
    prisma.license.count(),
    prisma.licenseActivation.count(),
    prisma.order.count(),
    prisma.receipt.count(),
    prisma.supportConversation.count(),
    prisma.telegramRecoveryGrant.count(),
    prisma.refreshToken.count(),
    prisma.trialGrant.count(),
  ]);

  console.log(
    JSON.stringify(
      {
        mode: 'DRY_RUN_ONLY',
        scope: 'USER_DATA_RESET',
        counts: {
          users,
          devices,
          telegramAccounts,
          licenses,
          activations,
          orders,
          receipts,
          supportConversations,
          recoverySessions,
          refreshTokens,
          trialGrants,
        },
        warning: 'No data was deleted. Execute only after explicit human approval.',
      },
      null,
      2,
    ),
  );
}

void main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
