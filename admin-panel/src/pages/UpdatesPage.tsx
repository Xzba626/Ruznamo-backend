import { useEffect, useState } from 'react';
import {
  fetchReleasesOverview,
  publishRelease,
  updateReleaseDraft,
  uploadReleaseApk,
} from '../api/admin';
import { getErrorMessage } from '../api/client';
import { useStrings } from '../context/LocaleContext';
import { formatDateTime } from '../i18n';

function formatBytes(size: number): string {
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function UpdatesPage() {
  const strings = useStrings();
  const [overview, setOverview] = useState<Awaited<ReturnType<typeof fetchReleasesOverview>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [changelogRu, setChangelogRu] = useState('');
  const [changelogTg, setChangelogTg] = useState('');
  const [mandatory, setMandatory] = useState(false);
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    fetchReleasesOverview()
      .then(setOverview)
      .catch((err) => setError(getErrorMessage(err, strings.errors.generic)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleUpload = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const draft = await uploadReleaseApk(file);
      setSelectedDraftId(draft.id);
      await updateReleaseDraft(draft.id, { changelogRu, changelogTg, mandatory });
      load();
    } catch (err) {
      setError(getErrorMessage(err, strings.errors.generic));
    } finally {
      setUploading(false);
    }
  };

  const handlePublish = async (id: string) => {
    setError('');
    try {
      await updateReleaseDraft(id, { changelogRu, changelogTg, mandatory });
      await publishRelease(id);
      load();
    } catch (err) {
      setError(getErrorMessage(err, strings.errors.generic));
    }
  };

  if (loading) return <p>{strings.updates.loading}</p>;

  return (
    <div>
      <h1>{strings.updates.title}</h1>
      {error && <div className="alert error">{error}</div>}

      <section className="card section">
        <h2>{strings.updates.currentVersion}</h2>
        {!overview?.current ? (
          <p className="muted">{strings.updates.noCurrent}</p>
        ) : (
          <>
            <p className="lead">{overview.current.versionLabel}</p>
            <p className="muted">
              {strings.updates.publishedAt}: {overview.current.publishedAt ? formatDateTime(overview.current.publishedAt) : strings.common.dash}
            </p>
            <p className="muted">
              {strings.updates.fileSize}: {formatBytes(overview.current.fileSize)} · SHA-256:{' '}
              <span className="mono">{overview.current.sha256.slice(0, 16)}…</span>
            </p>
            <p className="muted">
              {strings.updates.adoption}: {overview.current.adoption.percent}% ({overview.current.adoption.count})
            </p>
          </>
        )}
      </section>

      <section className="card section">
        <h2>{strings.updates.addUpdate}</h2>
        <div className="form-grid">
          <label>
            {strings.updates.uploadApk}
            <input
              type="file"
              accept=".apk,application/vnd.android.package-archive"
              disabled={uploading}
              onChange={(event) => void handleUpload(event.target.files?.[0] ?? null)}
            />
          </label>
          <label>
            {strings.updates.changelogRu}
            <textarea value={changelogRu} onChange={(e) => setChangelogRu(e.target.value)} rows={3} />
          </label>
          <label>
            {strings.updates.changelogTg}
            <textarea value={changelogTg} onChange={(e) => setChangelogTg(e.target.value)} rows={3} />
          </label>
          <label className="checkbox-row">
            <input type="checkbox" checked={mandatory} onChange={(e) => setMandatory(e.target.checked)} />
            {strings.updates.mandatory}
          </label>
        </div>
        {uploading && <p>{strings.common.loading}</p>}
        {selectedDraftId && (
          <button type="button" className="btn-primary" onClick={() => void handlePublish(selectedDraftId)}>
            {strings.updates.publish}
          </button>
        )}
      </section>

      <section className="section">
        <h2>{strings.updates.history}</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{strings.updates.colVersion}</th>
                <th>{strings.updates.colStatus}</th>
                <th>{strings.updates.colDevices}</th>
                <th>{strings.updates.colDate}</th>
                <th>{strings.common.actions}</th>
              </tr>
            </thead>
            <tbody>
              {(overview?.history ?? []).map((row) => (
                <tr key={row.id}>
                  <td>{row.versionLabel}</td>
                  <td>{row.status}</td>
                  <td>{row.deviceCount ?? 0}</td>
                  <td>{row.publishedAt ? formatDateTime(row.publishedAt) : strings.common.dash}</td>
                  <td>
                    {row.status === 'DRAFT' && (
                      <button type="button" className="btn-secondary" onClick={() => void handlePublish(row.id)}>
                        {strings.updates.publish}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
