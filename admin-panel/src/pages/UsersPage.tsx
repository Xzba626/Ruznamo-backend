import { FormEvent, useEffect, useState } from 'react';
import { fetchUsers } from '../api/admin';
import { getErrorMessage } from '../api/client';
import type { Paginated } from '../api/types';
import {
  formatDate,
  formatTelegramUser,
  labelLicenseStatus,
  labelUserStatus,
  t,
} from '../i18n';

type UserRow = {
  id: string;
  displayName: string | null;
  email: string | null;
  phone: string | null;
  category: string;
  status: string;
  createdAt: string;
  deviceCount: number;
  telegram: { telegramId: string; username: string | null; firstName: string | null } | null;
  activeLicense: { keyPrefix: string; status: string } | null;
};

export function UsersPage() {
  const strings = t();
  const [data, setData] = useState<Paginated<UserRow> | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    fetchUsers(page, search)
      .then((res) => setData(res as Paginated<UserRow>))
      .catch((err) => setError(getErrorMessage(err, strings.errors.loadUsers)))
      .finally(() => setLoading(false));
  }, [page, search, strings.errors.loadUsers]);

  function onSearch(e: FormEvent) {
    e.preventDefault();
    setPage(1);
  }

  return (
    <div>
      <h1>{strings.users.title}</h1>
      <form className="toolbar" onSubmit={onSearch}>
        <input placeholder={strings.users.searchPlaceholder} value={search} onChange={(e) => setSearch(e.target.value)} />
        <button type="submit" className="btn-secondary">{strings.common.search}</button>
      </form>
      {loading && <p>{strings.users.loading}</p>}
      {error && <div className="alert error">{error}</div>}
      {!loading && data && data.items.length === 0 && <p className="muted">{strings.users.empty}</p>}
      {!loading && data && data.items.length > 0 && (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{strings.users.colName}</th>
                  <th>{strings.users.colTelegram}</th>
                  <th>{strings.users.colContact}</th>
                  <th>{strings.users.colStatus}</th>
                  <th>{strings.users.colLicense}</th>
                  <th>{strings.users.colDevices}</th>
                  <th>{strings.users.colCreated}</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((user) => (
                  <tr key={user.id}>
                    <td>{user.displayName ?? strings.common.dash}</td>
                    <td>{formatTelegramUser(user.telegram ?? undefined)}</td>
                    <td>{user.email ?? user.phone ?? strings.common.dash}</td>
                    <td>{labelUserStatus(user.status)}</td>
                    <td>
                      {user.activeLicense
                        ? `${user.activeLicense.keyPrefix} (${labelLicenseStatus(user.activeLicense.status)})`
                        : strings.common.dash}
                    </td>
                    <td>{user.deviceCount}</td>
                    <td>{formatDate(user.createdAt)}</td>
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
