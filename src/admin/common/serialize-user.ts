/** Safe JSON serialization for admin user + Telegram nested objects. */
export function serializeTelegramAccount(
  account: {
    telegramId: bigint;
    username: string | null;
    firstName: string | null;
    lastName?: string | null;
    language?: string | null;
    linkedAt?: Date;
  } | null,
) {
  if (!account) {
    return null;
  }

  return {
    telegramId: account.telegramId.toString(),
    username: account.username,
    firstName: account.firstName,
    lastName: account.lastName ?? null,
    language: account.language ?? null,
    linkedAt: account.linkedAt ?? null,
  };
}

export function serializeOrderUser(
  user: {
    id: string;
    displayName: string | null;
    email: string | null;
    telegramAccount: {
      telegramId: bigint;
      username: string | null;
      firstName: string | null;
      lastName?: string | null;
      language?: string | null;
      linkedAt?: Date;
    } | null;
  } | null,
) {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    displayName: user.displayName,
    email: user.email,
    telegramAccount: serializeTelegramAccount(user.telegramAccount),
  };
}

export function maskInstallationId(installationId: string): string {
  if (installationId.length <= 10) {
    return installationId;
  }
  return `${installationId.slice(0, 4)}…${installationId.slice(-4)}`;
}
