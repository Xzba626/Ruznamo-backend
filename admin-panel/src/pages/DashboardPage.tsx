import { useEffect, useState } from 'react';
import { fetchDashboardSummary, fetchSystemStatus, fetchTelegramStatus } from '../api/admin';
import { ApiClientError } from '../api/client';

export function DashboardPage() {
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof fetchDashboardSummary>> | null>(null);
  const [system, setSystem] = useState<Awaited<ReturnType<typeof fetchSystemStatus>> | null>(null);
  const [telegram, setTelegram] = useState<Awaited<ReturnType<typeof fetchTelegramStatus>> | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchDashboardSummary(), fetchSystemStatus(), fetchTelegramStatus()])
      .then(([s, sys, tg]) => {
        setSummary(s);
        setSystem(sys);
        setTelegram(tg);
      })
      .catch((err) => setError(err instanceof ApiClientError ? err.message : 'Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading dashboard…</p>;
  if (error) return <div className="alert error">{error}</div>;
  if (!summary) return <p>No data</p>;

  return (
    <div>
      <h1>Dashboard</h1>
      <div className="grid cards">
        <div className="card"><div className="label">Users</div><div className="value">{summary.users.total}</div></div>
        <div className="card"><div className="label">Active users</div><div className="value">{summary.users.active}</div></div>
        <div className="card"><div className="label">Trial users</div><div className="value">{summary.users.trial}</div></div>
        <div className="card"><div className="label">Active licenses</div><div className="value">{summary.licenses.active}</div></div>
        <div className="card"><div className="label">Active devices</div><div className="value">{summary.devices.active}</div></div>
        <div className="card">
          <div className="label">Telegram</div>
          <div className="value">{telegram?.isVerified ? 'Connected' : 'Not connected'}</div>
        </div>
      </div>
      <section className="section">
        <h2>System</h2>
        <p>API: {system?.api} · Database: {system?.database} · Readiness: {system?.readiness}</p>
      </section>
      <section className="section">
        <h2>Recent activity</h2>
        {summary.recentActivity.length === 0 ? (
          <p className="muted">No audit events yet.</p>
        ) : (
          <table>
            <thead><tr><th>Time</th><th>Action</th><th>Actor</th></tr></thead>
            <tbody>
              {summary.recentActivity.map((e) => (
                <tr key={e.id}>
                  <td>{new Date(e.createdAt).toLocaleString()}</td>
                  <td>{e.action}</td>
                  <td>{e.actorEmail ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
