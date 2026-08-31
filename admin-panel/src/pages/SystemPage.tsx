import { useEffect, useState } from 'react';
import { fetchSystemStatus } from '../api/admin';
import { ApiClientError } from '../api/client';

export function SystemPage() {
  const [status, setStatus] = useState<Awaited<ReturnType<typeof fetchSystemStatus>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchSystemStatus()
      .then(setStatus)
      .catch((err) => setError(err instanceof ApiClientError ? err.message : 'Failed to load system status'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading system status…</p>;
  if (error) return <div className="alert error">{error}</div>;
  if (!status) return <p>No data</p>;

  return (
    <div>
      <h1>System</h1>
      <div className="grid cards">
        <div className="card"><div className="label">API</div><div className="value">{status.api}</div></div>
        <div className="card"><div className="label">Database</div><div className="value">{status.database}</div></div>
        <div className="card"><div className="label">Readiness</div><div className="value">{status.readiness}</div></div>
        <div className="card"><div className="label">Version</div><div className="value">{status.version}</div></div>
        <div className="card"><div className="label">Environment</div><div className="value">{status.environment}</div></div>
      </div>
    </div>
  );
}
