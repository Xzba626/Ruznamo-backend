import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { fetchSystemStatus } from '../api/admin';
import { getErrorMessage } from '../api/client';
import { formatDateTime, labelServiceStatus, labelSystemHealth, t } from '../i18n';

const ADMIN_PANEL_VERSION = '0.1.0';

function statusClass(status: string): string {
  if (status === 'healthy' || status === 'info') return 'status-healthy';
  if (status === 'warning') return 'status-warning';
  if (status === 'error') return 'status-error';
  return 'status-neutral';
}

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
      <p className="muted">{strings.system.checkedAt}: {formatDateTime(status.checkedAt)}</p>

      <div className="grid cards system-cards">
        <div className={`card service-card ${statusClass(status.backend.status)}`}>
          <div className="card-title">{strings.system.backend}</div>
          <div className="card-status">{labelServiceStatus(status.backend.status)}</div>
          <div className="card-meta">{strings.system.version}: {status.backend.version}</div>
          <div className="card-meta">{strings.system.environment}: {labelSystemHealth(status.backend.environment)}</div>
          {status.backend.buildId && (
            <div className="card-meta mono">{strings.system.buildId}: {status.backend.buildId.slice(0, 8)}</div>
          )}
        </div>

        <div className={`card service-card ${statusClass(status.database.status)}`}>
          <div className="card-title">{strings.system.database}</div>
          <div className="card-status">{labelServiceStatus(status.database.status)}</div>
          <div className="card-meta">{strings.system.migrations}: {status.database.migrationCount}</div>
        </div>

        <div className={`card service-card ${statusClass(status.readiness.status)}`}>
          <div className="card-title">{strings.system.readiness}</div>
          <div className="card-status">{labelServiceStatus(status.readiness.status)}</div>
        </div>

        <div className={`card service-card ${statusClass(status.android.status)}`}>
          <div className="card-title">{strings.system.android}</div>
          <div className="card-meta">{strings.system.configuredLatest}: {status.android.configuredLatestVersion ?? strings.common.dash}</div>
          <div className="card-meta">{strings.system.minimumSupported}: {status.android.minimumSupportedVersion ?? strings.common.dash}</div>
          <div className="card-meta">{strings.system.forceUpdate}: {status.android.forceUpdate ? strings.common.yes : strings.common.no}</div>
        </div>

        <div className={`card service-card ${statusClass(status.telegram.status)}`}>
          <div className="card-title">{strings.system.telegram}</div>
          <div className="card-status">{labelServiceStatus(status.telegram.status)}</div>
          <div className="card-meta">{strings.system.enabled}: {status.telegram.enabled ? strings.common.yes : strings.common.no}</div>
          {status.telegram.botUsername && (
            <div className="card-meta">{strings.system.botUsername}: @{status.telegram.botUsername}</div>
          )}
          <div className="card-meta">{strings.system.webhook}: {labelServiceStatus(status.telegram.webhook.status)}</div>
          {status.telegram.webhook.lastError && (
            <div className={`card-meta ${status.telegram.webhook.lastErrorHistorical ? 'muted' : 'warn'}`}>
              {status.telegram.webhook.lastErrorHistorical
                ? strings.system.lastRegisteredError
                : strings.system.lastError}
              :{' '}
              {status.telegram.webhook.lastErrorAt
                ? `${formatDateTime(status.telegram.webhook.lastErrorAt)} — `
                : ''}
              {status.telegram.webhook.lastError}
            </div>
          )}
        </div>

        <div className={`card service-card ${statusClass(status.adminPanel.status)}`}>
          <div className="card-title">{strings.system.adminPanel}</div>
          <div className="card-meta">{strings.system.version}: {ADMIN_PANEL_VERSION}</div>
          <div className="card-meta muted">{status.adminPanel.note}</div>
        </div>
      </div>

      <section className="section">
        <h2>{strings.system.deviceVersions}</h2>
        {status.android.deviceVersionDistribution.length === 0 ? (
          <p className="muted">{strings.system.noDeviceVersions}</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>{strings.system.colVersion}</th><th>{strings.system.colDevices}</th></tr></thead>
              <tbody>
                {status.android.deviceVersionDistribution.map((row) => (
                  <tr key={row.appVersion}>
                    <td>{row.appVersion}</td>
                    <td>{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="muted">{status.android.note}</p>
      </section>

      <section className="section links-row">
        <NavLink to="/system/data" className="btn-secondary">{strings.system.dataManagement}</NavLink>
      </section>
    </div>
  );
}
