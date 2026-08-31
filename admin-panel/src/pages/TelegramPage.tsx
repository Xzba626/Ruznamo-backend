import { useEffect, useState } from 'react';
import { createTelegramConnect, fetchTelegramStatus } from '../api/admin';
import { ApiClientError } from '../api/client';

export function TelegramPage() {
  const [status, setStatus] = useState<Awaited<ReturnType<typeof fetchTelegramStatus>> | null>(null);
  const [code, setCode] = useState<{ code: string; expiresAt: string; instructions: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    try {
      setStatus(await fetchTelegramStatus());
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to load Telegram status');
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
      setCode({ code: result.code, expiresAt: result.expiresAt, instructions: result.instructions });
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to generate code');
    } finally {
      setGenerating(false);
    }
  }

  if (loading) return <p>Loading Telegram status…</p>;

  return (
    <div>
      <h1>Telegram</h1>
      {error && <div className="alert error">{error}</div>}
      <div className="card section">
        <p><strong>Status:</strong> {status?.isVerified ? 'Connected' : 'Not connected'}</p>
        {status?.telegramUserId && <p><strong>Telegram ID:</strong> {status.telegramUserId}</p>}
        {status?.verifiedAt && <p><strong>Connected at:</strong> {new Date(status.verifiedAt).toLocaleString()}</p>}
      </div>
      {!status?.isVerified && (
        <section className="section">
          <p className="muted">Generate a one-time code, then send <code>/start CODE</code> to the Admin Bot.</p>
          <button type="button" className="btn-primary" onClick={() => void generateCode()} disabled={generating}>
            {generating ? 'Generating…' : 'Generate connection code'}
          </button>
          {code && (
            <div className="card section">
              <p><strong>Code:</strong> <span className="mono">{code.code}</span></p>
              <p><strong>Expires:</strong> {new Date(code.expiresAt).toLocaleString()}</p>
              <p>{code.instructions}</p>
              <button type="button" className="btn-secondary" onClick={() => void load()}>
                Refresh status
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
