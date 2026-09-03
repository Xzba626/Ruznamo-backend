import { FormEvent, useEffect, useState } from 'react';
import { fetchDevices } from '../api/admin';
import { getErrorMessage } from '../api/client';
import type { Paginated } from '../api/types';
import { formatDate, formatDateTime, labelDeviceActive, labelPlatform, t } from '../i18n';

type DeviceRow = {
  id: string;
  installationId: string;
  deviceName: string | null;
  deviceManufacturer: string | null;
  deviceModel: string | null;
  platform: string;
  appVersion: string | null;
  appVersionLabel: string | null;
  appVersionUnknown: boolean;
  appLocale: string | null;
  lastSeenAt: string | null;
  isActive: boolean;
  createdAt: string;
  user: { id: string; displayName: string | null; email: string | null };
};

export function DevicesPage() {
  const strings = t();
  const [data, setData] = useState<Paginated<DeviceRow> | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    fetchDevices(page, search)
      .then((res) => setData(res as Paginated<DeviceRow>))
      .catch((err) => setError(getErrorMessage(err, strings.errors.loadDevices)))
      .finally(() => setLoading(false));
  }, [page, search, strings.errors.loadDevices]);

  function onSearch(e: FormEvent) {
    e.preventDefault();
    setPage(1);
  }

  return (
    <div>
      <h1>{strings.devices.title}</h1>
      <form className="toolbar" onSubmit={onSearch}>
        <input placeholder={strings.devices.searchPlaceholder} value={search} onChange={(e) => setSearch(e.target.value)} />
        <button type="submit" className="btn-secondary">{strings.common.search}</button>
      </form>
      {loading && <p>{strings.devices.loading}</p>}
      {error && <div className="alert error">{error}</div>}
      {!loading && data && data.items.length === 0 && <p className="muted">{strings.devices.empty}</p>}
      {!loading && data && data.items.length > 0 && (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{strings.devices.colDevice}</th>
                  <th>{strings.devices.colUser}</th>
                  <th>{strings.devices.colPlatform}</th>
                  <th>{strings.devices.colStatus}</th>
                  <th>{strings.devices.colLastSeen}</th>
                  <th>{strings.devices.colRegistered}</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((device) => {
                  const hardware = [device.deviceManufacturer, device.deviceModel]
                    .filter(Boolean)
                    .join(' ');
                  const versionLabel = device.appVersionLabel
                    ?? (device.appVersionUnknown || !device.appVersion ? 'UNKNOWN' : device.appVersion);
                  return (
                  <tr key={device.id}>
                    <td>
                      {hardware || device.deviceName || device.installationId}
                      {hardware ? (
                        <div className="muted" style={{ fontSize: 12 }}>{device.installationId}</div>
                      ) : null}
                    </td>
                    <td>{device.user.displayName ?? device.user.email ?? strings.common.dash}</td>
                    <td>{labelPlatform(device.platform)} · {versionLabel}{device.appLocale ? ` · ${device.appLocale}` : ''}</td>
                    <td>{labelDeviceActive(device.isActive)}</td>
                    <td>{device.lastSeenAt ? formatDateTime(device.lastSeenAt) : strings.common.dash}</td>
                    <td>{formatDate(device.createdAt)}</td>
                  </tr>
                  );
                })}
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
