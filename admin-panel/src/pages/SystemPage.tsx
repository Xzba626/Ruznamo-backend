import { useEffect, useState } from 'react';
import { fetchSystemStatus } from '../api/admin';
import { getErrorMessage } from '../api/client';
import { labelSystemHealth, t } from '../i18n';

export function SystemPage() {
  const strings = t();
  const [status, setStatus] = useState<Awaited<ReturnType<typeof fetchSystemStatus>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchSystemStatus()
      .then(setStatus)
      .catch((err) => setError(getErrorMessage(err, strings.errors.loadSystem)))
      .finally(() => setLoading(false));
  }, [strings.errors.loadSystem]);

  if (loading) return <p>{strings.system.loading}</p>;
  if (error) return <div className="alert error">{error}</div>;
  if (!status) return <p>{strings.common.noData}</p>;

  return (
    <div>
      <h1>{strings.system.title}</h1>
      <div className="grid cards">
        <div className="card"><div className="label">{strings.system.api}</div><div className="value">{labelSystemHealth(status.api)}</div></div>
        <div className="card"><div className="label">{strings.system.database}</div><div className="value">{labelSystemHealth(status.database)}</div></div>
        <div className="card"><div className="label">{strings.system.readiness}</div><div className="value">{labelSystemHealth(status.readiness)}</div></div>
        <div className="card"><div className="label">{strings.system.version}</div><div className="value">{status.version}</div></div>
        <div className="card"><div className="label">{strings.system.environment}</div><div className="value">{labelSystemHealth(status.environment)}</div></div>
      </div>
    </div>
  );
}
