import { FormEvent, useEffect, useState } from 'react';
import { fetchUsers } from '../api/admin';
import { ApiClientError } from '../api/client';
import type { Paginated } from '../api/types';

type UserRow = {
  id: string;
  displayName: string | null;
  email: string | null;
  phone: string | null;
  category: string;
  status: string;
  createdAt: string;
  deviceCount: number;
  activeLicense: { keyPrefix: string; status: string } | null;
};

export function UsersPage() {
  const [data, setData] = useState<Paginated<UserRow> | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    fetchUsers(page, search)
      .then((res) => setData(res as Paginated<UserRow>))
      .catch((err) => setError(err instanceof ApiClientError ? err.message : 'Failed to load users'))
      .finally(() => setLoading(false));
  }, [page, search]);

  function onSearch(e: FormEvent) {
    e.preventDefault();
    setPage(1);
  }

  return (
    <div>
      <h1>Users</h1>
      <form className="toolbar" onSubmit={onSearch}>
        <input placeholder="Search users…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <button type="submit" className="btn-secondary">Search</button>
      </form>
      {loading && <p>Loading users…</p>}
      {error && <div className="alert error">{error}</div>}
      {!loading && data && data.items.length === 0 && <p className="muted">No users found.</p>}
      {!loading && data && data.items.length > 0 && (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email / Phone</th>
                  <th>Status</th>
                  <th>License</th>
                  <th>Devices</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((user) => (
                  <tr key={user.id}>
                    <td>{user.displayName ?? '—'}</td>
                    <td>{user.email ?? user.phone ?? '—'}</td>
                    <td>{user.status}</td>
                    <td>{user.activeLicense?.keyPrefix ?? '—'}</td>
                    <td>{user.deviceCount}</td>
                    <td>{new Date(user.createdAt).toLocaleDateString()}</td>
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
