import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchDashboardSummary, fetchPlans, fetchSystemStatus, fetchTelegramStatus } from '../api/admin';
import { getErrorMessage } from '../api/client';
import {
  formatAuditAction,
  formatDateTime,
  labelPlanCode,
  labelPlanPurchaseAvailability,
  labelServiceStatus,
  labelSystemHealth,
  labelTelegramConnected,
  t,
} from '../i18n';

function AuditActionCell({ action }: { action: string }) {
  const strings = t();
  const presentation = formatAuditAction(action);
  return (
    <div className="audit-action-cell">
      <div>{presentation.label}</div>
      {presentation.technicalCode && (
        <div className="muted audit-technical-code">
          {strings.audit.technicalCode(presentation.technicalCode)}
        </div>
      )}
    </div>
  );
}

export function DashboardPage() {
  const strings = t();
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof fetchDashboardSummary>> | null>(null);
  const [system, setSystem] = useState<Awaited<ReturnType<typeof fetchSystemStatus>> | null>(null);
  const [telegram, setTelegram] = useState<Awaited<ReturnType<typeof fetchTelegramStatus>> | null>(null);
  const [plans, setPlans] = useState<Awaited<ReturnType<typeof fetchPlans>>['plans']>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([fetchDashboardSummary(), fetchSystemStatus(), fetchTelegramStatus(), fetchPlans()])
      .then(([summaryResult, systemResult, telegramResult, plansResult]) => {
        if (summaryResult.status === 'rejected') {
          throw summaryResult.reason;
        }
        setSummary(summaryResult.value);
        if (systemResult.status === 'fulfilled') {
          setSystem(systemResult.value);
        }
        if (telegramResult.status === 'fulfilled') {
          setTelegram(telegramResult.value);
        }
        if (plansResult.status === 'fulfilled') {
          setPlans(plansResult.value.plans);
        }
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
      {plans.length > 0 && (
        <section className="section">
          <h2>{strings.dashboard.plansTitle}</h2>
          <ul className="plan-status-list">
            {plans.map((plan) => (
              <li key={plan.id}>
                {labelPlanCode(plan.code)} — {labelPlanPurchaseAvailability(plan.isActive)}
              </li>
            ))}
          </ul>
          <p><Link to="/plans">{strings.dashboard.plansLink}</Link></p>
        </section>
      )}
      <section className="section">
        <h2>{strings.dashboard.system}</h2>
        <p>
          {strings.dashboard.systemLine(
            labelServiceStatus(system?.backend?.status ?? ''),
            labelSystemHealth(system?.database?.legacyState ?? ''),
            labelSystemHealth(system?.readiness?.legacyState ?? ''),
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
                    <td><AuditActionCell action={e.action} /></td>
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
