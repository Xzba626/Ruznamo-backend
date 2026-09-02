import { FormEvent, useEffect, useState } from 'react';
import { createManualLicense, fetchLicenses, revokeLicense } from '../api/admin';
import { getErrorMessage } from '../api/client';
import type { Paginated } from '../api/types';
import { formatDate, labelLicenseStatus, labelPlan, t } from '../i18n';
import { useAuth } from '../context/AuthContext';

type LicenseRow = {
  id: string;
  keyPrefix: string;
  status: string;
  plan: { code: string; name: string };
  user: { id: string; displayName: string | null; email: string | null } | null;
  activationCount: number;
  expiresAt: string | null;
  createdAt: string;
};

export function LicensesPage() {
  const strings = t();
  const { hasPermission } = useAuth();
  const canCreate = hasPermission('licenses:create');
  const [createOpen, setCreateOpen] = useState(false);
  const [planCode, setPlanCode] = useState('STANDARD');
  const [billingPeriod, setBillingPeriod] = useState('MONTHLY');
  const [customerLabel, setCustomerLabel] = useState('');
  const [createdKey, setCreatedKey] = useState('');
  const [creating, setCreating] = useState(false);
  const [data, setData] = useState<Paginated<LicenseRow> | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revoking, setRevoking] = useState<string | null>(null);
  const canRevoke = hasPermission('licenses:revoke');

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError('');
    setCreatedKey('');
    try {
      const res = await createManualLicense({
        planCode,
        billingPeriod,
        customerLabel: customerLabel.trim() || undefined,
      });
      setCreatedKey(res.licenseKey);
      setCreateOpen(false);
      load();
    } catch (err) {
      setError(getErrorMessage(err, strings.errors.loadLicenses));
    } finally {
      setCreating(false);
    }
  }

  function load() {
    setLoading(true);
    fetchLicenses(page, search)
      .then((res) => setData(res as Paginated<LicenseRow>))
      .catch((err) => setError(getErrorMessage(err, strings.errors.loadLicenses)))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, [page, search]);

  async function revoke(id: string) {
    if (!confirm(strings.licenses.confirmRevoke)) return;
    setRevoking(id);
    try {
      await revokeLicense(id);
      load();
    } catch (err) {
      setError(getErrorMessage(err, strings.errors.revokeLicense));
    } finally {
      setRevoking(null);
    }
  }

  function onSearch(e: FormEvent) {
    e.preventDefault();
    setPage(1);
  }

  return (
    <div>
      <h1>{strings.licenses.title}</h1>
      {canCreate && (
        <p>
          <button type="button" className="btn-primary" onClick={() => setCreateOpen((v) => !v)}>
            {strings.licenses.create}
          </button>
        </p>
      )}
      {createOpen && canCreate && (
        <form className="card" onSubmit={onCreate}>
          <label>
            {strings.licenses.colPlan}
            <select value={planCode} onChange={(e) => setPlanCode(e.target.value)}>
              <option value="STANDARD">Standard</option>
              <option value="PRO">Pro</option>
            </select>
          </label>
          <label>
            Срок
            <select value={billingPeriod} onChange={(e) => setBillingPeriod(e.target.value)}>
              <option value="MONTHLY">30 дней</option>
              <option value="YEARLY">365 дней</option>
            </select>
          </label>
          <label>
            Клиент (необязательно)
            <input value={customerLabel} onChange={(e) => setCustomerLabel(e.target.value)} />
          </label>
          <button type="submit" className="btn-primary" disabled={creating}>
            {creating ? strings.common.loading : strings.licenses.createSubmit}
          </button>
        </form>
      )}
      {createdKey && (
        <div className="alert success">
          <p>Ключ создан (скопируйте сейчас):</p>
          <p className="mono">{createdKey}</p>
        </div>
      )}
      <form className="toolbar" onSubmit={onSearch}>
        <input placeholder={strings.licenses.searchPlaceholder} value={search} onChange={(e) => setSearch(e.target.value)} />
        <button type="submit" className="btn-secondary">{strings.common.search}</button>
      </form>
      {loading && <p>{strings.licenses.loading}</p>}
      {error && <div className="alert error">{error}</div>}
      {!loading && data && data.items.length === 0 && <p className="muted">{strings.licenses.empty}</p>}
      {!loading && data && data.items.length > 0 && (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{strings.licenses.colKey}</th>
                  <th>{strings.licenses.colPlan}</th>
                  <th>{strings.licenses.colUser}</th>
                  <th>{strings.licenses.colStatus}</th>
                  <th>{strings.licenses.colActivations}</th>
                  <th>{strings.licenses.colExpires}</th>
                  {canRevoke && <th>{strings.common.actions}</th>}
                </tr>
              </thead>
              <tbody>
                {data.items.map((license) => (
                  <tr key={license.id}>
                    <td className="mono">{license.keyPrefix}</td>
                    <td>{labelPlan(license.plan)}</td>
                    <td>{license.user?.displayName ?? license.user?.email ?? strings.common.dash}</td>
                    <td>{labelLicenseStatus(license.status)}</td>
                    <td>{license.activationCount}</td>
                    <td>{license.expiresAt ? formatDate(license.expiresAt) : strings.common.dash}</td>
                    {canRevoke && (
                      <td>
                        {license.status !== 'REVOKED' && (
                          <button type="button" className="btn-danger" disabled={revoking === license.id} onClick={() => void revoke(license.id)}>
                            {revoking === license.id ? strings.licenses.revoking : strings.licenses.revoke}
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pager">
            <button type="button" className="btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>{strings.common.previousPage}</button>
            <span>{strings.common.pageOf(data.meta.page, data.meta.totalPages)}</span>
            <button type="button" className="btn-secondary" disabled={page >= data.meta.totalPages} onClick={() => setPage((p) => p + 1)}>{strings.common.nextPage}</button>
          </div>
        </>
      )}
    </div>
  );
}
