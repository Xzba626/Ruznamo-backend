import { useEffect, useState } from 'react';
import { fetchDashboardSummary, fetchSystemStatus, fetchTelegramStatus } from '../api/admin';
import { getErrorMessage } from '../api/client';
import {
  formatDateTime,
  labelAuditAction,
  labelSystemHealth,
  labelTelegramConnected,
  t,
} from '../i18n';

export function DashboardPage() {
  const strings = t();
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
      .catch((err) => setError(getErrorMessage(err, strings.errors.loadDashboard)))
      .finally(() => setLoading(false));
  }, [strings.errors.loadDashboard]);

  if (loading) return <p>{strings.common.loading}</p>;
  if (error) return <div className="alert error">{error}</div>;
  if (!summary) return <p>{strings.common.noData}</p>;

  return (
    <div>
      <h1>{strings.dashboard.title}</h1>
      <div className="grid cards">
        <div className="card"><div className="label">{strings.dashboard.usersTotal}</div><div className="value">{summary.users.total}</div></div>
        <div className="card"><div className="label">{strings.dashboard.usersActive}</div><div className="value">{summary.users.active}</div></div>
        <div className="card"><div className="label">{strings.dashboard.usersTrial}</div><div className="value">{summary.users.trial}</div></div>
        <div className="card"><div className="label">{strings.dashboard.licensesActive}</div><div className="value">{summary.licenses.active}</div></div>
        <div className="card"><div className="label">{strings.dashboard.devicesActive}</div><div className="value">{summary.devices.active}</div></div>
        <div className="card">
          <div className="label">{strings.dashboard.telegram}</div>
          <div className="value">{labelTelegramConnected(Boolean(telegram?.isVerified))}</div>
        </div>
      </div>
      <section className="section">
        <h2>{strings.dashboard.system}</h2>
        <p>
          {strings.dashboard.systemLine(
            labelSystemHealth(system?.api ?? ''),
            labelSystemHealth(system?.database ?? ''),
            labelSystemHealth(system?.readiness ?? ''),
          )}
        </p>
      </section>
      <section className="section">
        <h2>{strings.dashboard.recentActivity}</h2>
        {summary.recentActivity.length === 0 ? (
          <p className="muted">{strings.dashboard.noAudit}</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>{strings.dashboard.colTime}</th><th>{strings.dashboard.colAction}</th><th>{strings.dashboard.colActor}</th></tr></thead>
              <tbody>
                {summary.recentActivity.map((e) => (
                  <tr key={e.id}>
                    <td>{formatDateTime(e.createdAt)}</td>
                    <td>{labelAuditAction(e.action)}</td>
                    <td>{e.actorEmail ?? strings.common.dash}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
