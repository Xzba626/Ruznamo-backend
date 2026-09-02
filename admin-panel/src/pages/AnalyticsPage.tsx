import { useEffect, useState } from 'react';
import { fetchAnalyticsOverview, fetchAnalyticsSales } from '../api/admin';
import { getErrorMessage } from '../api/client';
import {
  formatDateTime,
  labelOrderStatus,
  labelPlanCode,
  labelUserCategory,
  t,
} from '../i18n';

export function AnalyticsPage() {
  const strings = t();
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchAnalyticsOverview>> | null>(null);
  const [sales, setSales] = useState<Awaited<ReturnType<typeof fetchAnalyticsSales>> | null>(null);
  const [salesPeriod, setSalesPeriod] = useState<'today' | '7d' | '30d' | 'month' | 'prev_month'>('30d');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([fetchAnalyticsOverview(), fetchAnalyticsSales(salesPeriod)])
      .then(([overview, salesData]) => {
        setData(overview);
        setSales(salesData);
      })
      .catch((err) => setError(getErrorMessage(err, strings.errors.loadAnalytics)))
      .finally(() => setLoading(false));
  }, [salesPeriod, strings.errors.loadAnalytics]);

  if (loading) return <p>{strings.analytics.loading}</p>;
  if (error) return <div className="alert error">{error}</div>;
  if (!data) return <p className="muted">{strings.analytics.empty}</p>;

  return (
    <div>
      <h1>{strings.analytics.title}</h1>
      <p className="muted">{strings.analytics.generatedAt}: {formatDateTime(data.generatedAt)}</p>

      <div className="grid cards">
        <div className="card"><div className="label">{strings.analytics.devicesTotal}</div><div className="value">{data.totals.devices}</div></div>
        <div className="card"><div className="label">{strings.analytics.activeDevices}</div><div className="value">{data.totals.activeDevices}</div></div>
        <div className="card"><div className="label">{strings.analytics.trialUsers}</div><div className="value">{data.totals.trialUsers}</div></div>
        <div className="card"><div className="label">{strings.analytics.activeLicenses}</div><div className="value">{data.totals.activeLicenses}</div></div>
        <div className="card"><div className="label">{strings.analytics.paidUsers}</div><div className="value">{data.totals.paidUsers}</div></div>
      </div>

      <section className="section">
        <h2>Продажи лицензий</h2>
        <div style={{ marginBottom: 12 }}>
          <select value={salesPeriod} onChange={(e) => setSalesPeriod(e.target.value as typeof salesPeriod)}>
            <option value="today">Сегодня</option>
            <option value="7d">7 дней</option>
            <option value="30d">30 дней</option>
            <option value="month">Этот месяц</option>
            <option value="prev_month">Прошлый месяц</option>
          </select>
        </div>
        {sales && (
          <div className="grid cards">
            <div className="card"><div className="label">Продано (Telegram)</div><div className="value">{sales.sold.total}</div></div>
            <div className="card"><div className="label">Выдано вручную</div><div className="value">{sales.manualIssued}</div></div>
            <div className="card"><div className="label">Выручка</div><div className="value">{sales.revenue.grossApproved} {sales.revenue.currency}</div></div>
            <div className="card"><div className="label">Активации (не продажи)</div><div className="value">{sales.activity.activations}</div></div>
          </div>
        )}
      </section>

      <section className="section">
        <h2>{strings.analytics.trends30d}</h2>
        <div className="grid cards">
          <div className="card"><div className="label">{strings.analytics.newInstallations}</div><div className="value">{data.trends30d.newInstallations}</div></div>
          <div className="card"><div className="label">{strings.analytics.licenseActivations}</div><div className="value">{data.trends30d.licenseActivations}</div></div>
          <div className="card"><div className="label">{strings.analytics.orders}</div><div className="value">{data.trends30d.orders}</div></div>
        </div>
      </section>

      <section className="section two-col">
        <div>
          <h2>{strings.analytics.categoryDistribution}</h2>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Категория</th><th>Кол-во</th><th>%</th></tr></thead>
              <tbody>
                {data.categoryDistribution.map((row) => (
                  <tr key={row.category}>
                    <td>{labelUserCategory(row.category)}</td>
                    <td>{row.count}</td>
                    <td>{row.percentage}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <h2>{strings.analytics.planDistribution}</h2>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Тариф</th><th>Кол-во</th></tr></thead>
              <tbody>
                {data.planDistribution.map((row) => (
                  <tr key={row.planCode}>
                    <td>{labelPlanCode(row.planCode)}</td>
                    <td>{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="section two-col">
        <div>
          <h2>{strings.analytics.appVersions}</h2>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Версия</th><th>Устройств</th></tr></thead>
              <tbody>
                {data.appVersionDistribution.map((row) => (
                  <tr key={row.appVersion}>
                    <td>{row.appVersion}</td>
                    <td>{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <h2>{strings.analytics.ordersByStatus}</h2>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Статус</th><th>Кол-во</th></tr></thead>
              <tbody>
                {data.ordersByStatus.map((row) => (
                  <tr key={row.status}>
                    <td>{labelOrderStatus(row.status)}</td>
                    <td>{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="section">
        <h2>{strings.analytics.definitions}</h2>
        <ul className="definition-list">
          {Object.entries(data.definitions).map(([key, value]) => (
            <li key={key}><strong>{key}</strong>: {value}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
