import { FormEvent, useEffect, useState } from 'react';
import { fetchDevice, fetchDeviceStats, fetchDevices } from '../api/admin';
import { getErrorMessage } from '../api/client';
import type { Paginated } from '../api/types';
import {
  formatDateTime,
  labelAccessBucket,
  labelEffectiveStatus,
  labelIntegrityReason,
  labelIntegrityStatus,
  labelLicenseStatus,
  labelTrialStatus,
  labelUserCategory,
  t,
} from '../i18n';

type Integrity = { status: string; reasons: string[] };

type DeviceRow = {
  id: string;
  installationId: string;
  deviceName: string | null;
  deviceManufacturer: string | null;
  deviceModel: string | null;
  androidOsVersion: string | null;
  sdkLevel: number | null;
  appVersionLabel: string | null;
  appVersionUnknown: boolean;
  appVersion: string | null;
  lastSeenAt: string | null;
  createdAt: string;
  accessBucket: string;
  roleId: string;
  displayName: string | null;
  integrity: Integrity;
  trial: { status: string; expiresAt: string } | null;
  license: {
    status: string;
    keyPrefix: string;
    expiresAt: string | null;
    boundToThisInstallation: boolean;
  } | null;
  clientReportedAccessState: string | null;
  serverEffectiveStatus: string;
};

type DeviceStats = {
  total: number;
  active30d: number;
  trial: number;
  licensed: number;
  trialExpired: number;
  review: number;
};

type DeviceDetail = DeviceRow & {
  device?: {
    manufacturer: string | null;
    model: string | null;
    androidOsVersion: string | null;
    sdkLevel: number | null;
  };
  application?: {
    versionLabel: string | null;
    versionCode: number | null;
    packageName: string | null;
    themeMode: string | null;
    firstSeenAt: string;
    lastSeenAt: string;
  };
  profile?: { roleId: string; displayName: string | null };
  security?: {
    status: string;
    reasons: string[];
    clientReportedAccessState: string | null;
    serverEffectiveStatus: string;
    note: string;
  };
};

export function DevicesPage() {
  const strings = t();
  const [data, setData] = useState<Paginated<DeviceRow> | null>(null);
  const [stats, setStats] = useState<DeviceStats | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [integrityFilter, setIntegrityFilter] = useState('');
  const [accessFilter, setAccessFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState<DeviceDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchDevices(page, search, {
        integrityStatus: integrityFilter || undefined,
        accessBucket: accessFilter || undefined,
      }),
      fetchDeviceStats(),
    ])
      .then(([listRes, statsRes]) => {
        setData(listRes as Paginated<DeviceRow>);
        setStats(statsRes);
      })
      .catch((err) => setError(getErrorMessage(err, strings.errors.loadDevices)))
      .finally(() => setLoading(false));
  }, [page, search, integrityFilter, accessFilter, strings.errors.loadDevices]);

  function onSearch(e: FormEvent) {
    e.preventDefault();
    setPage(1);
  }

  async function openDetail(id: string) {
    setDetailLoading(true);
    try {
      const res = (await fetchDevice(id)) as DeviceDetail;
      setDetail(res);
    } catch (err) {
      setError(getErrorMessage(err, strings.errors.loadDevices));
    } finally {
      setDetailLoading(false);
    }
  }

  const dash = strings.devices.dash;

  return (
    <div>
      <h1>{strings.devices.title}</h1>

      {stats && (
        <div className="grid cards" style={{ marginBottom: '1rem' }}>
          <div className="card">
            <div className="label">{strings.devices.statTotal}</div>
            <div className="value">{stats.total.toLocaleString('ru-RU')}</div>
          </div>
          <div className="card">
            <div className="label">{strings.devices.statActive30d}</div>
            <div className="value">{stats.active30d.toLocaleString('ru-RU')}</div>
          </div>
          <div className="card">
            <div className="label">{strings.devices.statTrial}</div>
            <div className="value">{stats.trial.toLocaleString('ru-RU')}</div>
          </div>
          <div className="card">
            <div className="label">{strings.devices.statLicensed}</div>
            <div className="value">{stats.licensed.toLocaleString('ru-RU')}</div>
          </div>
          <div className="card">
            <div className="label">{strings.devices.statTrialExpired}</div>
            <div className="value">{stats.trialExpired.toLocaleString('ru-RU')}</div>
          </div>
          <div className="card">
            <div className="label">{strings.devices.statReview}</div>
            <div className="value">{stats.review.toLocaleString('ru-RU')}</div>
          </div>
        </div>
      )}

      <form className="toolbar" onSubmit={onSearch}>
        <input
          placeholder={strings.devices.searchPlaceholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          value={integrityFilter}
          onChange={(e) => {
            setIntegrityFilter(e.target.value);
            setPage(1);
          }}
          aria-label={strings.devices.colStatus}
        >
          <option value="">{strings.devices.filterAll}</option>
          <option value="REVIEW">{strings.devices.filterReview}</option>
          <option value="NORMAL">{labelIntegrityStatus('NORMAL')}</option>
        </select>
        <select
          value={accessFilter}
          onChange={(e) => {
            setAccessFilter(e.target.value);
            setPage(1);
          }}
          aria-label={strings.devices.colLicense}
        >
          <option value="">{strings.devices.filterAll}</option>
          <option value="LICENSED">{strings.devices.filterLicensed}</option>
          <option value="TRIAL">{strings.devices.filterTrial}</option>
          <option value="TRIAL_EXPIRED">{strings.devices.filterTrialExpired}</option>
        </select>
        <button type="submit" className="btn-secondary">
          {strings.common.search}
        </button>
      </form>

      {loading && <p>{strings.devices.loading}</p>}
      {error && <div className="alert error">{error}</div>}
      {!loading && data && data.items.length === 0 && (
        <p className="muted">{strings.devices.empty}</p>
      )}
      {!loading && data && data.items.length > 0 && (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{strings.devices.colDevice}</th>
                  <th>{strings.devices.colVersion}</th>
                  <th>{strings.devices.colRole}</th>
                  <th>{strings.devices.colName}</th>
                  <th>{strings.devices.colLicense}</th>
                  <th>{strings.devices.colTrial}</th>
                  <th>{strings.devices.colLastSeen}</th>
                  <th>{strings.devices.colStatus}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.items.map((device) => {
                  const hardware = [device.deviceManufacturer, device.deviceModel]
                    .filter(Boolean)
                    .join(' ');
                  const versionLabel =
                    device.appVersionLabel ??
                    (device.appVersionUnknown || !device.appVersion
                      ? strings.devices.unknownVersion
                      : device.appVersion);
                  return (
                    <tr key={device.id}>
                      <td>
                        {hardware || device.deviceName || device.installationId}
                        {hardware ? (
                          <div className="muted" style={{ fontSize: 12 }}>
                            {device.installationId}
                          </div>
                        ) : null}
                      </td>
                      <td>{versionLabel}</td>
                      <td>{labelUserCategory(device.roleId)}</td>
                      <td>{device.displayName ?? dash}</td>
                      <td>
                        {device.license
                          ? labelLicenseStatus(device.license.status)
                          : labelAccessBucket(device.accessBucket === 'LICENSED' ? 'LICENSED' : 'NONE')}
                      </td>
                      <td>
                        {device.trial ? labelTrialStatus(device.trial.status) : dash}
                      </td>
                      <td>
                        {device.lastSeenAt ? formatDateTime(device.lastSeenAt) : dash}
                      </td>
                      <td>
                        {device.integrity.status === 'REVIEW' ? (
                          <span className="card-meta warn">
                            ⚠ {labelIntegrityStatus(device.integrity.status)}
                          </span>
                        ) : (
                          labelIntegrityStatus(device.integrity.status)
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => openDetail(device.id)}
                        >
                          {strings.devices.open}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="pager">
            <button
              type="button"
              className="btn-secondary"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              {strings.common.previousPage}
            </button>
            <span>{strings.common.pageOf(data.meta.page, data.meta.totalPages)}</span>
            <button
              type="button"
              className="btn-secondary"
              disabled={page >= data.meta.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              {strings.common.nextPage}
            </button>
          </div>
        </>
      )}

      {(detail || detailLoading) && (
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <h2 style={{ margin: 0 }}>{strings.devices.detailTitle}</h2>
            <button type="button" className="btn-secondary" onClick={() => setDetail(null)}>
              {strings.devices.close}
            </button>
          </div>
          {detailLoading && <p>{strings.devices.loading}</p>}
          {detail && (
            <div className="form-grid" style={{ marginTop: '1rem' }}>
              <section>
                <h3>{strings.devices.sectionDevice}</h3>
                <p>
                  {strings.devices.manufacturer}: {detail.device?.manufacturer ?? dash}
                </p>
                <p>
                  {strings.devices.model}: {detail.device?.model ?? dash}
                </p>
                <p>
                  {strings.devices.android}: {detail.device?.androidOsVersion ?? dash}
                </p>
                <p>
                  {strings.devices.sdk}: {detail.device?.sdkLevel ?? dash}
                </p>
              </section>
              <section>
                <h3>{strings.devices.sectionApp}</h3>
                <p>
                  {strings.devices.colVersion}:{' '}
                  {detail.application?.versionLabel ?? detail.appVersionLabel ?? dash}
                </p>
                <p>
                  {strings.devices.versionCode}: {detail.application?.versionCode ?? dash}
                </p>
                <p>
                  {strings.devices.packageName}: {detail.application?.packageName ?? dash}
                </p>
                <p>
                  {strings.devices.firstSeen}:{' '}
                  {formatDateTime(detail.application?.firstSeenAt ?? detail.createdAt)}
                </p>
                <p>
                  {strings.devices.lastSeen}:{' '}
                  {detail.lastSeenAt ? formatDateTime(detail.lastSeenAt) : dash}
                </p>
              </section>
              <section>
                <h3>{strings.devices.sectionProfile}</h3>
                <p>
                  {strings.devices.colRole}:{' '}
                  {labelUserCategory(detail.profile?.roleId ?? detail.roleId)}
                </p>
                <p>
                  {strings.devices.colName}:{' '}
                  {detail.profile?.displayName ?? detail.displayName ?? dash}
                </p>
                <p className="muted" style={{ fontSize: 13 }}>
                  {strings.devices.integrityNote}
                </p>
              </section>
              <section>
                <h3>{strings.devices.sectionLicense}</h3>
                <p>
                  {strings.devices.colTrial}:{' '}
                  {detail.trial ? labelTrialStatus(detail.trial.status) : dash}
                </p>
                <p>
                  {strings.devices.colLicense}:{' '}
                  {detail.license
                    ? `${labelLicenseStatus(detail.license.status)} (${detail.license.keyPrefix}…)`
                    : labelAccessBucket(detail.accessBucket)}
                </p>
                <p>
                  {strings.devices.expiry}:{' '}
                  {detail.license?.expiresAt
                    ? formatDateTime(detail.license.expiresAt)
                    : detail.trial?.expiresAt
                      ? formatDateTime(detail.trial.expiresAt)
                      : dash}
                </p>
                <p>
                  {strings.devices.bound}:{' '}
                  {detail.license
                    ? detail.license.boundToThisInstallation
                      ? 'Да'
                      : 'Нет'
                    : dash}
                </p>
              </section>
              <section>
                <h3>{strings.devices.sectionSecurity}</h3>
                <p>
                  {strings.devices.colStatus}:{' '}
                  {labelIntegrityStatus(detail.security?.status ?? detail.integrity.status)}
                </p>
                <p>
                  {strings.devices.clientState}:{' '}
                  {detail.security?.clientReportedAccessState
                    ? labelEffectiveStatus(detail.security.clientReportedAccessState)
                    : detail.clientReportedAccessState
                      ? labelEffectiveStatus(detail.clientReportedAccessState)
                      : dash}
                </p>
                <p>
                  {strings.devices.serverState}:{' '}
                  {labelEffectiveStatus(
                    detail.security?.serverEffectiveStatus ?? detail.serverEffectiveStatus,
                  )}
                </p>
                {(detail.security?.reasons ?? detail.integrity.reasons).length > 0 && (
                  <ul>
                    {(detail.security?.reasons ?? detail.integrity.reasons).map((code) => (
                      <li key={code}>{labelIntegrityReason(code)}</li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
