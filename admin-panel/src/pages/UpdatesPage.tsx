import { useEffect, useRef, useState } from 'react';
import {
  deleteDraftRelease,
  fetchReleasesOverview,
  finalizeReleaseUpload,
  publishRelease,
  requestReleaseUploadAuthorization,
  updateReleaseDraft,
  uploadApkToBlob,
} from '../api/admin';
import { getErrorMessage } from '../api/client';
import { useStrings } from '../context/LocaleContext';
import { formatDateTime } from '../i18n';

type PagePhase = 'PAGE_LOADING' | 'IDLE' | 'ERROR';
type UploadPhase =
  | 'IDLE'
  | 'FILE_SELECTED'
  | 'REQUESTING_UPLOAD_AUTH'
  | 'UPLOADING'
  | 'VALIDATING'
  | 'DRAFT_READY'
  | 'ERROR';

const PENDING_UPLOAD_KEY = 'ruznamo_pending_apk_upload';

type PendingUpload = {
  uploadId: string;
  fileName: string;
  fileSize: number;
};

function readPendingUpload(): PendingUpload | null {
  try {
    const raw = sessionStorage.getItem(PENDING_UPLOAD_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingUpload;
    if (!parsed?.uploadId || !parsed.fileName) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writePendingUpload(pending: PendingUpload | null) {
  if (!pending) {
    sessionStorage.removeItem(PENDING_UPLOAD_KEY);
    return;
  }
  sessionStorage.setItem(PENDING_UPLOAD_KEY, JSON.stringify(pending));
}

function formatBytes(size: number): string {
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function UpdatesPage() {
  const strings = useStrings();
  const [overview, setOverview] = useState<Awaited<ReturnType<typeof fetchReleasesOverview>> | null>(
    null,
  );
  const [pagePhase, setPagePhase] = useState<PagePhase>('PAGE_LOADING');
  const [pageError, setPageError] = useState('');
  const [uploadPhase, setUploadPhase] = useState<UploadPhase>('IDLE');
  const [uploadError, setUploadError] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [draft, setDraft] = useState<Awaited<ReturnType<typeof finalizeReleaseUpload>> | null>(null);
  const [pendingUpload, setPendingUpload] = useState<PendingUpload | null>(() => readPendingUpload());
  const [uploadProgress, setUploadProgress] = useState<{ loaded: number; total: number } | null>(null);
  const [changelogRu, setChangelogRu] = useState('');
  const [changelogTg, setChangelogTg] = useState('');
  const [mandatory, setMandatory] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [changelogTab, setChangelogTab] = useState<'ru' | 'tj'>('ru');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadOverview = (opts?: { soft?: boolean }) => {
    if (!opts?.soft) {
      setPagePhase('PAGE_LOADING');
    }
    setPageError('');
    fetchReleasesOverview()
      .then((data) => {
        setOverview(data);
        setPagePhase('IDLE');
      })
      .catch((err) => {
        setPageError(getErrorMessage(err, strings.updates.loadFailed));
        setPagePhase('ERROR');
      });
  };

  useEffect(() => {
    loadOverview();
  }, []);

  const storageConfigured = overview?.storageConfigured ?? false;
  const signingConfigured = overview?.signingConfigured ?? false;
  const manifestSigningConfigured = overview?.manifestSigningConfigured ?? false;
  const publishReady = signingConfigured && manifestSigningConfigured;

  const selectFile = (file: File | null) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.apk')) {
      setUploadError(strings.updates.acceptedFormat);
      setUploadPhase('ERROR');
      return;
    }
    setSelectedFile(file);
    setDraft(null);
    setUploadError('');
    setUploadPhase('FILE_SELECTED');
  };

  const clearFile = () => {
    setSelectedFile(null);
    setDraft(null);
    setUploadError('');
    setUploadPhase('IDLE');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const clearPending = () => {
    writePendingUpload(null);
    setPendingUpload(null);
  };

  const rememberPending = (next: PendingUpload) => {
    writePendingUpload(next);
    setPendingUpload(next);
  };

  const mapUploadError = (err: unknown, phase: UploadPhase): string => {
    const fallback =
      phase === 'REQUESTING_UPLOAD_AUTH'
        ? strings.updates.uploadAuthFailed
        : phase === 'UPLOADING'
          ? strings.updates.blobWriteFailed
          : phase === 'VALIDATING'
            ? strings.updates.validationFailed
            : strings.updates.finalizeFailed;
    return getErrorMessage(err, fallback);
  };

  const finalizeExistingUpload = async (uploadId: string) => {
    setUploadPhase('VALIDATING');
    const uploaded = await finalizeReleaseUpload(uploadId);
    setDraft(uploaded);
    setUploadPhase('DRAFT_READY');
    clearPending();
    try {
      await updateReleaseDraft(uploaded.id, { changelogRu, changelogTg, mandatory });
    } catch {
      // Draft already exists; changelog can be edited later. Do not undo success.
    }
    await loadOverview({ soft: true });
  };

  const startUpload = async (opts?: { resumeOnly?: boolean }) => {
    const resumeOnly = Boolean(opts?.resumeOnly);
    const resumable =
      pendingUpload &&
      (!selectedFile ||
        (selectedFile.name === pendingUpload.fileName &&
          selectedFile.size === pendingUpload.fileSize));

    if (resumeOnly || (resumable && pendingUpload && !selectedFile)) {
      if (!pendingUpload) return;
      setUploadError('');
      setUploadProgress(null);
      try {
        await finalizeExistingUpload(pendingUpload.uploadId);
      } catch (err) {
        setUploadPhase('ERROR');
        setUploadError(mapUploadError(err, 'VALIDATING'));
      }
      return;
    }

    if (!selectedFile || !storageConfigured) return;
    setUploadError('');
    setUploadProgress(null);
    let phase: UploadPhase = 'REQUESTING_UPLOAD_AUTH';
    try {
      if (resumable && pendingUpload) {
        await finalizeExistingUpload(pendingUpload.uploadId);
        return;
      }

      setUploadPhase('REQUESTING_UPLOAD_AUTH');
      phase = 'REQUESTING_UPLOAD_AUTH';
      const auth = await requestReleaseUploadAuthorization(selectedFile.size);

      setUploadPhase('UPLOADING');
      phase = 'UPLOADING';
      await uploadApkToBlob(auth.uploadUrl, selectedFile, auth.headers, (loaded, total) => {
        setUploadProgress({ loaded, total });
      });
      rememberPending({
        uploadId: auth.uploadId,
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
      });

      phase = 'VALIDATING';
      await finalizeExistingUpload(auth.uploadId);
    } catch (err) {
      setUploadPhase('ERROR');
      setUploadError(mapUploadError(err, phase));
      // Keep pendingUpload only after a successful Blob PUT (resume finalize).
      if (phase === 'REQUESTING_UPLOAD_AUTH' || phase === 'UPLOADING') {
        clearPending();
      }
    }
  };

  const handleDeleteDraft = async (id: string) => {
    try {
      await deleteDraftRelease(id);
      clearFile();
      loadOverview({ soft: true });
    } catch (err) {
      setUploadError(getErrorMessage(err, strings.errors.generic));
    }
  };

  const handlePublish = async (id: string) => {
    if (!publishReady) return;
    const versionLabel =
      draft && 'versionLabel' in draft && typeof draft.versionLabel === 'string'
        ? draft.versionLabel
        : (overview?.history.find((row) => row.id === id)?.versionLabel ?? '');
    if (!window.confirm(strings.updates.publishConfirm(versionLabel ?? ''))) {
      return;
    }
    setPublishing(true);
    setUploadError('');
    try {
      await updateReleaseDraft(id, { changelogRu, changelogTg, mandatory });
      await publishRelease(id);
      clearFile();
      loadOverview({ soft: true });
    } catch (err) {
      setUploadError(getErrorMessage(err, strings.errors.generic));
    } finally {
      setPublishing(false);
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return strings.updates.statusDraft;
      case 'PUBLISHED':
        return strings.updates.statusPublished;
      case 'ARCHIVED':
        return strings.updates.statusArchived;
      case 'PURGED':
        return strings.updates.statusPurged;
      default:
        return status;
    }
  };

  if (pagePhase === 'PAGE_LOADING' && !overview) {
    return (
      <div className="updates-page">
        <h1>{strings.updates.title}</h1>
        <div className="skeleton-stack">
          <div className="skeleton-block" />
          <div className="skeleton-block" />
        </div>
      </div>
    );
  }

  return (
    <div className="updates-page">
      <h1>{strings.updates.title}</h1>

      {pagePhase === 'ERROR' && (
        <div className="alert error section-error">
          {pageError || strings.updates.loadFailed}
          <button type="button" className="btn-secondary" onClick={() => loadOverview()}>
            {strings.updates.retry}
          </button>
        </div>
      )}

      <section className="card section">
        <h2>{strings.updates.currentVersion}</h2>
        {!overview?.current ? (
          <div className="empty-state">
            <div className="empty-icon" aria-hidden>
              📦
            </div>
            <h3>{strings.updates.noCurrentTitle}</h3>
            <p className="muted">{strings.updates.noCurrentDescription}</p>
            <button
              type="button"
              className="btn-primary"
              onClick={() => fileInputRef.current?.click()}
              disabled={!storageConfigured}
            >
              {strings.updates.uploadApk}
            </button>
          </div>
        ) : (
          <>
            <p className="lead">{overview.current.versionLabel}</p>
            <p className="muted">
              {strings.updates.publishedAt}:{' '}
              {overview.current.publishedAt
                ? formatDateTime(overview.current.publishedAt)
                : strings.common.dash}
            </p>
            <p className="muted">
              {strings.updates.fileSize}: {formatBytes(overview.current.fileSize)} · SHA-256:{' '}
              <span className="mono">{overview.current.sha256.slice(0, 16)}…</span>
            </p>
            <p className="muted">
              {strings.updates.adoption}: {overview.current.adoption.percent}% (
              {overview.current.adoption.count})
            </p>
          </>
        )}
      </section>

      <section className="card section">
        <h2>{strings.updates.addUpdate}</h2>

        {storageConfigured ? (
          <div className="alert success">
            <strong>{strings.updates.storageConfiguredLabel}</strong>
            <p className="muted">{strings.updates.storageConfiguredHint}</p>
          </div>
        ) : (
          <div className="alert warn">
            <strong>{strings.updates.storageNotConfigured}</strong>
            <p className="muted">{strings.updates.storageNotConfiguredHint}</p>
          </div>
        )}

        {signingConfigured ? (
          <div className="alert success">
            <strong>{strings.updates.signingConfiguredLabel}</strong>
          </div>
        ) : (
          <div className="alert warn">
            <strong>{strings.updates.signingNotConfigured}</strong>
            <p className="muted">{strings.updates.signingNotConfiguredHint}</p>
          </div>
        )}

        {manifestSigningConfigured ? (
          <div className="alert success">
            <strong>{strings.updates.manifestConfiguredLabel}</strong>
            {overview?.manifestSigningKeyId ? (
              <p className="muted mono">keyId: {overview.manifestSigningKeyId}</p>
            ) : null}
          </div>
        ) : (
          <div className="alert warn">
            <strong>{strings.updates.manifestNotConfigured}</strong>
            <p className="muted">{strings.updates.manifestNotConfiguredHint}</p>
          </div>
        )}

        <div
          className={`apk-dropzone ${!storageConfigured ? 'disabled' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
          }}
          onDrop={(e) => {
            e.preventDefault();
            if (!storageConfigured) return;
            selectFile(e.dataTransfer.files?.[0] ?? null);
          }}
        >
          <p className="dropzone-title">{strings.updates.dropzoneTitle}</p>
          <p className="muted">{strings.updates.dropzoneOr}</p>
          <button
            type="button"
            className="btn-secondary"
            disabled={
              !storageConfigured ||
              uploadPhase === 'UPLOADING' ||
              uploadPhase === 'REQUESTING_UPLOAD_AUTH' ||
              uploadPhase === 'VALIDATING'
            }
            onClick={() => fileInputRef.current?.click()}
          >
            {strings.updates.chooseApk}
          </button>
          <p className="muted">{strings.updates.acceptedFormat}</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".apk,application/vnd.android.package-archive"
            hidden
            onChange={(event) => selectFile(event.target.files?.[0] ?? null)}
          />
        </div>

        {selectedFile && (
          <div className="selected-file-row">
            <div>
              <div className="label">{strings.updates.selectedFile}</div>
              <strong>{selectedFile.name}</strong>
              <div className="muted">{formatBytes(selectedFile.size)}</div>
            </div>
            <div className="selected-file-actions">
              <button type="button" className="btn-secondary" onClick={clearFile}>
                {strings.updates.removeFile}
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={
                  !storageConfigured ||
                  uploadPhase === 'UPLOADING' ||
                  uploadPhase === 'REQUESTING_UPLOAD_AUTH' ||
                  uploadPhase === 'VALIDATING'
                }
                onClick={() => void startUpload()}
              >
                {uploadPhase === 'UPLOADING'
                  ? strings.updates.uploadingApk
                  : strings.updates.startUpload}
              </button>
            </div>
          </div>
        )}

        {(uploadPhase === 'REQUESTING_UPLOAD_AUTH' ||
          uploadPhase === 'UPLOADING' ||
          uploadPhase === 'VALIDATING') && (
          <div className="upload-progress">
            {uploadPhase === 'UPLOADING' && uploadProgress ? (
              <>
                <div
                  className="progress-bar"
                  style={{
                    width: `${Math.min(100, Math.round((uploadProgress.loaded / uploadProgress.total) * 100))}%`,
                  }}
                />
                <p>
                  {strings.updates.uploadingApk}{' '}
                  {Math.round((uploadProgress.loaded / uploadProgress.total) * 100)}% ·{' '}
                  {formatBytes(uploadProgress.loaded)} / {formatBytes(uploadProgress.total)}
                </p>
              </>
            ) : (
              <>
                <div className="progress-bar indeterminate" />
                <p>
                  {uploadPhase === 'VALIDATING'
                    ? strings.updates.validatingApk
                    : strings.updates.preparingUpload}
                </p>
              </>
            )}
          </div>
        )}

        {pendingUpload && uploadPhase !== 'DRAFT_READY' && (
          <div className="alert warn">
            <strong>{strings.updates.resumeFinalize}</strong>
            <p className="muted">
              {pendingUpload.fileName} · {formatBytes(pendingUpload.fileSize)}.{' '}
              {strings.updates.pendingUploadHint}
            </p>
            <button type="button" className="btn-secondary" onClick={() => void startUpload({ resumeOnly: true })}>
              {strings.updates.resumeFinalize}
            </button>
          </div>
        )}

        {uploadError && (
          <div className="alert error section-error">
            {uploadError}
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setUploadError('');
                void startUpload({ resumeOnly: Boolean(pendingUpload) });
              }}
            >
              {pendingUpload ? strings.updates.resumeFinalize : strings.common.retry}
            </button>
          </div>
        )}

        {draft && (
          <div className="validation-card">
            <h3>{strings.updates.validationTitle}</h3>
            <ul className="validation-list">
              <li>
                <span>{strings.updates.validationPackage}</span>
                <strong>{draft.packageName}</strong>
                <em className="check ok">{strings.updates.checkOk}</em>
              </li>
              <li>
                <span>{strings.updates.validationVersion}</span>
                <strong>{draft.versionName}</strong>
                <em className="check ok">{strings.updates.checkOk}</em>
              </li>
              <li>
                <span>{strings.updates.validationVersionCode}</span>
                <strong>{draft.versionCode}</strong>
                <em className="check ok">{strings.updates.checkOk}</em>
              </li>
              <li>
                <span>{strings.updates.validationFileSize}</span>
                <strong>{formatBytes(draft.fileSize)}</strong>
                <em className="check ok">{strings.updates.checkOk}</em>
              </li>
              <li>
                <span>{strings.updates.validationSha256}</span>
                <strong className="mono">{draft.sha256.slice(0, 24)}…</strong>
                <em className="check ok">{strings.updates.checkOk}</em>
              </li>
              <li>
                <span>{strings.updates.validationSigning}</span>
                <strong className="mono">{draft.signingCertificateSha256.slice(0, 24)}…</strong>
                <em className={`check ${signingConfigured ? 'ok' : 'warn'}`}>
                  {signingConfigured
                    ? strings.updates.checkOk
                    : strings.updates.checkNeedsConfig}
                </em>
              </li>
            </ul>
          </div>
        )}

        <div className="changelog-block">
          <h3>{strings.updates.changelogSection}</h3>
          <div className="tabs">
            <button
              type="button"
              className={changelogTab === 'ru' ? 'active' : ''}
              onClick={() => setChangelogTab('ru')}
            >
              {strings.updates.changelogRu}
            </button>
            <button
              type="button"
              className={changelogTab === 'tj' ? 'active' : ''}
              onClick={() => setChangelogTab('tj')}
            >
              {strings.updates.changelogTg}
            </button>
          </div>
          {changelogTab === 'ru' ? (
            <textarea
              value={changelogRu}
              onChange={(e) => setChangelogRu(e.target.value)}
              rows={4}
              placeholder={strings.updates.changelogRu}
            />
          ) : (
            <textarea
              value={changelogTg}
              onChange={(e) => setChangelogTg(e.target.value)}
              rows={4}
              placeholder={strings.updates.changelogTg}
            />
          )}
        </div>

        <label className="switch-row">
          <input
            type="checkbox"
            checked={mandatory}
            onChange={(e) => setMandatory(e.target.checked)}
          />
          <span>
            <strong>{strings.updates.mandatory}</strong>
            <span className="muted switch-hint">{strings.updates.mandatoryHint}</span>
          </span>
        </label>

        {draft && (
          <div className="selected-file-actions">
            <button
              type="button"
              className="btn-primary"
              disabled={!publishReady || publishing}
              onClick={() => void handlePublish(draft.id)}
            >
              {publishing ? strings.updates.publishing : strings.updates.publish}
            </button>
            <button type="button" className="btn-secondary" onClick={() => void handleDeleteDraft(draft.id)}>
              {strings.updates.deleteDraft}
            </button>
          </div>
        )}
      </section>

      <section className="section">
        <h2>{strings.updates.history}</h2>
        {(overview?.history ?? []).length === 0 ? (
          <div className="empty-state card">
            <p>{strings.updates.historyEmpty}</p>
          </div>
        ) : (
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
                    <td>
                      {row.versionLabel}
                      <div className="muted">{formatBytes(row.fileSize)}</div>
                    </td>
                    <td>{statusLabel(row.status)}</td>
                    <td>
                      {row.deviceCount === undefined || row.deviceCount === null
                        ? strings.updates.unknownAdoption
                        : row.deviceCount}
                    </td>
                    <td>
                      {row.publishedAt ? formatDateTime(row.publishedAt) : strings.common.dash}
                    </td>
                    <td>
                      {row.status === 'DRAFT' && (
                        <button
                          type="button"
                          className="btn-secondary"
                          disabled={!publishReady || publishing}
                          onClick={() => void handlePublish(row.id)}
                        >
                          {strings.updates.publish}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
