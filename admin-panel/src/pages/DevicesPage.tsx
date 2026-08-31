import { FormEvent, useEffect, useState } from 'react';
import { fetchDevices } from '../api/admin';
import { ApiClientError } from '../api/client';
import type { Paginated } from '../api/types';

type DeviceRow = {
  id: string;
  installationId: string;
  deviceName: string | null;
  platform: string;
  appVersion: string | null;
  lastSeenAt: string | null;
  isActive: boolean;
  createdAt: string;
  user: { id: string; displayName: string | null; email: string | null };
};

export function DevicesPage() {
  const [data, setData] = useState<Paginated<DeviceRow> | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    fetchDevices(page, search)
      .then((res) => setData(res as Paginated<DeviceRow>))
      .catch((err) => setError(err instanceof ApiClientError ? err.message : 'Failed to load devices'))
      .finally(() => setLoading(false));
  }, [page, search]);

  function onSearch(e: FormEvent) {
    e.preventDefault();
    setPage(1);
  }

  return (
    <div>
      <h1>Devices</h1>
      <form className="toolbar" onSubmit={onSearch}>
        <input placeholder="Search devices…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <button type="submit" className="btn-secondary">Search</button>
      </form>
      {loading && <p>Loading devices…</p>}
      {error && <div className="alert error">{error}</div>}
      {!loading && data && data.items.length === 0 && <p className="muted">No devices found.</p>}
      {!loading && data && data.items.length > 0 && (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Device</th>
                  <th>User</th>
                  <th>Platform</th>
                  <th>Status</th>
                  <th>Last seen</th>
                  <th>Registered</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((device) => (
                  <tr key={device.id}>
                    <td>{device.deviceName ?? device.installationId}</td>
                    <td>{device.user.displayName ?? device.user.email ?? '—'}</td>
                    <td>{device.platform}</td>
                    <td>{device.isActive ? 'Active' : 'Revoked'}</td>
                    <td>{device.lastSeenAt ? new Date(device.lastSeenAt).toLocaleString() : '—'}</td>
                    <td>{new Date(device.createdAt).toLocaleDateString()}</td>
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
