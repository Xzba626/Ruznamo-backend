import { useEffect, useState } from 'react';
import { fetchAudit } from '../api/admin';
import { getErrorMessage } from '../api/client';
import type { Paginated } from '../api/types';
import { formatDateTime, labelAuditAction, labelEntityType, t } from '../i18n';

type AuditRow = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  actorEmail: string | null;
  ipAddress: string | null;
  createdAt: string;
};

export function AuditPage() {
  const strings = t();
  const [data, setData] = useState<Paginated<AuditRow> | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    fetchAudit(page)
      .then((res) => setData(res as Paginated<AuditRow>))
      .catch((err) => setError(getErrorMessage(err, strings.errors.loadAudit)))
      .finally(() => setLoading(false));
  }, [page, strings.errors.loadAudit]);

  return (
    <div>
      <h1>{strings.audit.title}</h1>
      {loading && <p>{strings.audit.loading}</p>}
      {error && <div className="alert error">{error}</div>}
      {!loading && data && data.items.length === 0 && <p className="muted">{strings.audit.empty}</p>}
      {!loading && data && data.items.length > 0 && (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{strings.audit.colTime}</th>
                  <th>{strings.audit.colAction}</th>
                  <th>{strings.audit.colEntity}</th>
                  <th>{strings.audit.colActor}</th>
                  <th>{strings.audit.colIp}</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((entry) => (
                  <tr key={entry.id}>
                    <td>{formatDateTime(entry.createdAt)}</td>
                    <td>{labelAuditAction(entry.action)}</td>
                    <td>
                      {labelEntityType(entry.entityType)}
                      {entry.entityId ? ` #${entry.entityId.slice(0, 8)}` : ''}
                    </td>
                    <td>{entry.actorEmail ?? strings.common.dash}</td>
                    <td>{entry.ipAddress ?? strings.common.dash}</td>
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
