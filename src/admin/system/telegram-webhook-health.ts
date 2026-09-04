export type ServiceStatus = 'healthy' | 'warning' | 'error' | 'info' | 'not_configured';

export type TelegramWebhookProbeInput = {
  url?: string | null;
  lastErrorMessage?: string | null;
  /** Unix seconds from Telegram getWebhookInfo.last_error_date */
  lastErrorDateUnix?: number | null;
  pendingUpdateCount?: number | null;
  /** Now override for tests */
  nowMs?: number;
  /** Recent window: last_error within this many ms is treated as current. Default 30 minutes. */
  recentErrorWindowMs?: number;
};

export type TelegramWebhookProbeResult = {
  status: ServiceStatus;
  lastError: string | null;
  lastErrorAt: string | null;
  lastErrorHistorical: boolean;
  pendingUpdateCount?: number;
  url?: string | null;
};

/**
 * Telegram keeps last_error_message even after the webhook recovers.
 * Presence of last_error alone must NOT imply a current outage.
 */
export function evaluateTelegramWebhookHealth(
  input: TelegramWebhookProbeInput,
): TelegramWebhookProbeResult {
  const url = input.url ?? null;
  const lastError = input.lastErrorMessage ?? null;
  const pending = input.pendingUpdateCount ?? 0;
  const lastErrorAt =
    input.lastErrorDateUnix && input.lastErrorDateUnix > 0
      ? new Date(input.lastErrorDateUnix * 1000).toISOString()
      : null;
  const nowMs = input.nowMs ?? Date.now();
  const windowMs = input.recentErrorWindowMs ?? 30 * 60 * 1000;
  const errorAgeMs =
    input.lastErrorDateUnix && input.lastErrorDateUnix > 0
      ? nowMs - input.lastErrorDateUnix * 1000
      : null;
  const recentError = Boolean(lastError && errorAgeMs != null && errorAgeMs >= 0 && errorAgeMs <= windowMs);
  const historical = Boolean(lastError && !recentError);

  if (!url) {
    return {
      status: 'not_configured',
      lastError,
      lastErrorAt,
      lastErrorHistorical: historical,
      pendingUpdateCount: pending,
      url,
    };
  }

  if (pending > 0 && (recentError || Boolean(lastError))) {
    return {
      status: 'error',
      lastError,
      lastErrorAt,
      lastErrorHistorical: false,
      pendingUpdateCount: pending,
      url,
    };
  }

  if (recentError) {
    return {
      status: 'warning',
      lastError,
      lastErrorAt,
      lastErrorHistorical: false,
      pendingUpdateCount: pending,
      url,
    };
  }

  return {
    status: 'healthy',
    lastError,
    lastErrorAt,
    lastErrorHistorical: historical,
    pendingUpdateCount: pending,
    url,
  };
}
