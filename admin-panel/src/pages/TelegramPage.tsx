import { useEffect, useState } from 'react';
import { createTelegramConnect, fetchTelegramStatus } from '../api/admin';
import { getErrorMessage } from '../api/client';
import { formatDateTime, labelTelegramConnected, t } from '../i18n';

export function TelegramPage() {
  const strings = t();
  const [status, setStatus] = useState<Awaited<ReturnType<typeof fetchTelegramStatus>> | null>(null);
  const [code, setCode] = useState<{ code: string; expiresAt: string; deepLink: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    try {
      setStatus(await fetchTelegramStatus());
    } catch (err) {
      setError(getErrorMessage(err, strings.errors.loadTelegram));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function generateCode() {
    setGenerating(true);
    setError('');
    try {
      const result = await createTelegramConnect();
      setCode({ code: result.code, expiresAt: result.expiresAt, deepLink: result.deepLink });
    } catch (err) {
      setError(getErrorMessage(err, strings.errors.loadTelegram));
    } finally {
      setGenerating(false);
    }
  }

  if (loading) return <p>{strings.telegram.loading}</p>;

  return (
    <div>
      <h1>{strings.telegram.title}</h1>
      {error && <div className="alert error">{error}</div>}
      <div className="card section">
        <p><strong>{strings.telegram.status}:</strong> {labelTelegramConnected(Boolean(status?.isVerified))}</p>
        {status?.telegramUserId && <p><strong>{strings.telegram.telegramId}:</strong> {status.telegramUserId}</p>}
        {status?.verifiedAt && <p><strong>{strings.telegram.connectedAt}:</strong> {formatDateTime(status.verifiedAt)}</p>}
      </div>
      {!status?.isVerified && (
        <section className="section">
          <p className="muted">{strings.telegram.generateHint}</p>
          <button type="button" className="btn-primary" onClick={() => void generateCode()} disabled={generating}>
            {generating ? strings.telegram.generating : strings.telegram.generate}
          </button>
          {code && (
            <div className="card section">
              <p><strong>{strings.telegram.code}:</strong> <span className="mono">{code.code}</span></p>
              <p><strong>{strings.telegram.expires}:</strong> {formatDateTime(code.expiresAt)}</p>
              {code.deepLink && (
                <p>
                  <a href={code.deepLink} target="_blank" rel="noreferrer">{strings.telegram.openBot}</a>
                </p>
              )}
              <button type="button" className="btn-secondary" onClick={() => void load()}>
                {strings.telegram.refreshStatus}
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
