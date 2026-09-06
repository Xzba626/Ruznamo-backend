import { useEffect, useState } from 'react';
import {
  fetchPrivacyOverview,
  publishPrivacyDraft,
  savePrivacyDraft,
} from '../api/admin';
import { getErrorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { formatDateTime, labelReleaseStatus, t } from '../i18n';

type PrivacyRow = {
  id: string;
  revision: number;
  contentRu: string;
  contentTg: string;
  status: string;
  updatedAt: string;
  publishedAt: string | null;
  publishReady: boolean;
  missingLocales: string[];
};

type Overview = {
  current: PrivacyRow | null;
  draft: PrivacyRow | null;
  history: PrivacyRow[];
};

export function PrivacyPage() {
  const strings = t();
  const { hasPermission } = useAuth();
  const canManage =
    hasPermission('content:manage') || hasPermission('releases:manage');
  const [overview, setOverview] = useState<Overview | null>(null);
  const [localeTab, setLocaleTab] = useState<'ru' | 'tj'>('ru');
  const [contentRu, setContentRu] = useState('');
  const [contentTg, setContentTg] = useState('');
  const [draftId, setDraftId] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(false);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = (await fetchPrivacyOverview()) as Overview;
      setOverview(data);
      const source = data.draft ?? data.current;
      setDraftId(data.draft?.id);
      setContentRu(source?.contentRu ?? '');
      setContentTg(source?.contentTg ?? '');
    } catch (err) {
      setError(getErrorMessage(err, strings.errors.generic));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSaveDraft() {
    if (!canManage) return;
    setSaving(true);
    setError('');
    try {
      const saved = (await savePrivacyDraft({
        id: draftId,
        contentRu,
        contentTg,
      })) as PrivacyRow;
      setDraftId(saved.id);
      await load();
    } catch (err) {
      setError(getErrorMessage(err, strings.errors.generic));
    } finally {
      setSaving(false);
    }
  }

  async function onPublish() {
    if (!canManage || !draftId) return;
    if (!window.confirm(strings.privacy.publishConfirm)) return;
    setPublishing(true);
    setError('');
    try {
      await publishPrivacyDraft(draftId);
      await load();
    } catch (err) {
      setError(getErrorMessage(err, strings.errors.generic));
    } finally {
      setPublishing(false);
    }
  }

  const activeContent = localeTab === 'ru' ? contentRu : contentTg;

  return (
    <div>
      <h1>{strings.privacy.title}</h1>
      <p className="muted">{strings.privacy.subtitle}</p>

      {loading && <p>{strings.common.loading}</p>}
      {error && <div className="alert error">{error}</div>}

      {overview?.current && (
        <section className="card section" style={{ marginBottom: '1rem' }}>
          <h2>{strings.privacy.currentTitle}</h2>
          <p>
            {strings.privacy.revision}: {overview.current.revision} ·{' '}
            {labelReleaseStatus(overview.current.status)}
          </p>
          <p className="muted">
            {strings.privacy.publishedAt}:{' '}
            {overview.current.publishedAt
              ? formatDateTime(overview.current.publishedAt)
              : strings.common.dash}
          </p>
        </section>
      )}

      <section className="card section">
        <h2>{strings.privacy.editorTitle}</h2>
        <div className="toolbar">
          <button
            type="button"
            className={localeTab === 'ru' ? 'btn-primary' : 'btn-secondary'}
            onClick={() => setLocaleTab('ru')}
          >
            {strings.privacy.tabRu}
          </button>
          <button
            type="button"
            className={localeTab === 'tj' ? 'btn-primary' : 'btn-secondary'}
            onClick={() => setLocaleTab('tj')}
          >
            {strings.privacy.tabTj}
          </button>
          <button type="button" className="btn-secondary" onClick={() => setPreview((v) => !v)}>
            {preview ? strings.privacy.hidePreview : strings.privacy.showPreview}
          </button>
        </div>

        {!preview ? (
          <textarea
            className="privacy-editor"
            rows={22}
            value={activeContent}
            disabled={!canManage}
            onChange={(e) => {
              if (localeTab === 'ru') setContentRu(e.target.value);
              else setContentTg(e.target.value);
            }}
            placeholder={
              localeTab === 'ru' ? strings.privacy.placeholderRu : strings.privacy.placeholderTj
            }
            style={{ width: '100%', marginTop: '0.75rem', fontFamily: 'inherit', lineHeight: 1.5 }}
          />
        ) : (
          <pre
            className="privacy-preview"
            style={{
              whiteSpace: 'pre-wrap',
              marginTop: '0.75rem',
              lineHeight: 1.55,
              maxHeight: 480,
              overflow: 'auto',
            }}
          >
            {activeContent || strings.privacy.emptyPreview}
          </pre>
        )}

        {canManage && (
          <div className="toolbar" style={{ marginTop: '1rem' }}>
            <button type="button" className="btn-secondary" disabled={saving} onClick={() => void onSaveDraft()}>
              {saving ? strings.privacy.saving : strings.privacy.saveDraft}
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={publishing || !draftId || !contentRu.trim() || !contentTg.trim()}
              onClick={() => void onPublish()}
            >
              {publishing ? strings.privacy.publishing : strings.privacy.publish}
            </button>
          </div>
        )}
        {(!contentRu.trim() || !contentTg.trim()) && (
          <p className="muted" style={{ marginTop: '0.5rem' }}>
            {strings.privacy.bothLocalesRequired}
          </p>
        )}
      </section>

      <section className="section" style={{ marginTop: '1.5rem' }}>
        <h2>{strings.privacy.historyTitle}</h2>
        {(overview?.history ?? []).length === 0 ? (
          <p className="muted">{strings.privacy.historyEmpty}</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{strings.privacy.revision}</th>
                  <th>{strings.privacy.colStatus}</th>
                  <th>{strings.privacy.publishedAt}</th>
                  <th>{strings.privacy.updatedAt}</th>
                </tr>
              </thead>
              <tbody>
                {(overview?.history ?? []).map((row) => (
                  <tr key={row.id}>
                    <td>{row.revision}</td>
                    <td>{labelReleaseStatus(row.status)}</td>
                    <td>
                      {row.publishedAt ? formatDateTime(row.publishedAt) : strings.common.dash}
                    </td>
                    <td>{formatDateTime(row.updatedAt)}</td>
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
