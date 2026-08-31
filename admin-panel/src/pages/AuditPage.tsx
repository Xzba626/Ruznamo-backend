import { useEffect, useState } from 'react';
import { fetchAudit } from '../api/admin';
import { ApiClientError } from '../api/client';
import type { Paginated } from '../api/types';

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
  const [data, setData] = useState<Paginated<AuditRow> | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    fetchAudit(page)
      .then((res) => setData(res as Paginated<AuditRow>))
      .catch((err) => setError(err instanceof ApiClientError ? err.message : 'Failed to load audit logs'))
      .finally(() => setLoading(false));
  }, [page]);

  return (
    <div>
      <h1>Audit Logs</h1>
      {loading && <p>Loading audit logs…</p>}
      {error && <div className="alert error">{error}</div>}
      {!loading && data && data.items.length === 0 && <p className="muted">No audit events found.</p>}
      {!loading && data && data.items.length > 0 && (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>Actor</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((entry) => (
                  <tr key={entry.id}>
                    <td>{new Date(entry.createdAt).toLocaleString()}</td>
                    <td>{entry.action}</td>
                    <td>{entry.entityType}{entry.entityId ? ` #${entry.entityId.slice(0, 8)}` : ''}</td>
                    <td>{entry.actorEmail ?? '—'}</td>
                    <td>{entry.ipAddress ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pager">
            <button type="button" className="btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
            <span>Page {data.meta.page} of {data.meta.totalPages}</span>
            <button type="button" className="btn-secondary" disabled={page >= data.meta.totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
          </div>
        </>
      )}
    </div>
  );
}
