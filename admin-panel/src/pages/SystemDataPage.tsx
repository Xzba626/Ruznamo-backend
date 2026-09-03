import { useEffect, useMemo, useState } from 'react';
import {
  changeResetPassword,
  dataResetDryRun,
  fetchResetPasswordStatus,
  initializeResetPassword,
} from '../api/admin';
import { getErrorMessage } from '../api/client';
import { useStrings } from '../context/LocaleContext';
import { formatDateTime } from '../i18n';

type Scope = 'TEST_DATA_CLEANUP' | 'USER_DATA_RESET' | 'FACTORY_RESET';

type PreviewState = Awaited<ReturnType<typeof dataResetDryRun>>;

const COUNT_KEYS = [
  { key: 'users', labelKey: 'users' },
  { key: 'devices', labelKey: 'devices' },
  { key: 'telegramAccounts', labelKey: 'telegram' },
  { key: 'licenses', labelKey: 'licenses' },
  { key: 'activations', labelKey: 'activations' },
  { key: 'orders', labelKey: 'orders' },
  { key: 'receipts', labelKey: 'receipts' },
  { key: 'supportConversations', labelKey: 'support' },
  { key: 'recoverySessions', labelKey: 'recovery' },
  { key: 'refreshTokens', labelKey: 'refreshTokens' },
  { key: 'trialGrants', labelKey: 'trialGrants' },
] as const;

export function SystemDataPage() {
  const strings = useStrings();
  const [passwordStatus, setPasswordStatus] = useState<{ configured: boolean } | null>(null);
  const [passwordError, setPasswordError] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [scope, setScope] = useState<Scope>('USER_DATA_RESET');
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [previewError, setPreviewError] = useState('');
  const [previewBusy, setPreviewBusy] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [resetPassword, setResetPassword] = useState('');
  const [confirmationPhrase, setConfirmationPhrase] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [passwordFormError, setPasswordFormError] = useState('');
  const [passwordFormOk, setPasswordFormOk] = useState('');

  const loadPasswordStatus = () => {
    fetchResetPasswordStatus()
      .then((status) => {
        setPasswordStatus(status);
        setPasswordError('');
      })
      .catch((err) => {
        setPasswordStatus(null);
        setPasswordError(getErrorMessage(err, strings.dataReset.passwordLoadFailed));
      });
  };

  useEffect(() => {
    loadPasswordStatus();
  }, []);

  useEffect(() => {
    setPreview(null);
    setPreviewError('');
    setConfirmationPhrase('');
    setResetPassword('');
    setDetailsOpen(false);
  }, [scope]);

  const scopes: Array<{
    id: Scope;
    title: string;
    risk: string;
    hint: string;
    riskClass: string;
  }> = [
    {
      id: 'TEST_DATA_CLEANUP',
      title: strings.dataReset.scopeTest,
      risk: strings.dataReset.scopeTestRisk,
      hint: strings.dataReset.scopeTestHint,
      riskClass: 'risk-low',
    },
    {
      id: 'USER_DATA_RESET',
      title: strings.dataReset.scopeUser,
      risk: strings.dataReset.scopeUserRisk,
      hint: strings.dataReset.scopeUserHint,
      riskClass: 'risk-high',
    },
    {
      id: 'FACTORY_RESET',
      title: strings.dataReset.scopeFactory,
      risk: strings.dataReset.scopeFactoryRisk,
      hint: strings.dataReset.scopeFactoryHint,
      riskClass: 'risk-critical',
    },
  ];

  const executeLabel =
    scope === 'TEST_DATA_CLEANUP'
      ? strings.dataReset.executeTest
      : scope === 'FACTORY_RESET'
        ? strings.dataReset.executeFactory
        : strings.dataReset.executeUser;

  const passwordConfigured = Boolean(passwordStatus?.configured);

  const canPreview = !previewBusy;

  const executeBlockedReason = useMemo(() => {
    if (!passwordConfigured) return strings.dataReset.executeDisabledNoPassword;
    if (!preview) return strings.dataReset.executeDisabledNoPreview;
    if (!resetPassword.trim()) return strings.dataReset.resetPassword;
    if (confirmationPhrase.trim() !== strings.dataReset.confirmationPhrase) {
      return strings.dataReset.confirmationHint;
    }
    return '';
  }, [passwordConfigured, preview, resetPassword, confirmationPhrase, strings.dataReset]);

  const canShowExecuteForm = Boolean(preview) && passwordConfigured;

  const runPreview = async () => {
    setPreviewBusy(true);
    setPreviewError('');
    try {
      const response = await dataResetDryRun(scope);
      setPreview(response);
    } catch (err) {
      setPreview(null);
      setPreviewError(getErrorMessage(err, strings.dataReset.previewFailed));
    } finally {
      setPreviewBusy(false);
    }
  };

  const savePassword = async () => {
    setPasswordFormError('');
    setPasswordFormOk('');
    if (newPassword.length < 12) {
      setPasswordFormError(strings.dataReset.passwordMinLength);
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordFormError(strings.dataReset.passwordMismatch);
      return;
    }
    setPasswordBusy(true);
    try {
      if (passwordStatus?.configured) {
        await changeResetPassword({ currentPassword, newPassword, confirmPassword });
      } else {
        await initializeResetPassword({ newPassword, confirmPassword });
      }
      setNewPassword('');
      setConfirmPassword('');
      setCurrentPassword('');
      setPasswordFormOk(strings.dataReset.passwordConfigured);
      loadPasswordStatus();
    } catch (err) {
      setPasswordFormError(getErrorMessage(err, strings.errors.generic));
    } finally {
      setPasswordBusy(false);
    }
  };

  const preservedLabel = (key: string): string => {
    const map = strings.dataReset as Record<string, string>;
    return map[`preserved_${key}`] ?? key;
  };

  const scopeTitle = scopes.find((item) => item.id === scope)?.title ?? scope;

  return (
    <div className="data-reset-page">
      <h1>{strings.dataReset.title}</h1>
      <p className="muted page-lead">{strings.dataReset.subtitle}</p>

      <section className="card section">
        <div className="section-head">
          <h2>{strings.dataReset.passwordStatus}</h2>
          <span className={`badge ${passwordConfigured ? 'success' : 'warn'}`}>
            {passwordConfigured
              ? strings.dataReset.passwordConfigured
              : strings.dataReset.passwordNotConfigured}
          </span>
        </div>
        <p className="muted">{strings.dataReset.passwordHint}</p>
        {passwordError && (
          <div className="alert error section-error">
            {passwordError}
            <button type="button" className="btn-secondary" onClick={loadPasswordStatus}>
              {strings.common.retry}
            </button>
          </div>
        )}
        <div className="form-grid">
          {passwordConfigured && (
            <label>
              {strings.profile.currentPassword}
              <input
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </label>
          )}
          <label>
            {strings.profile.newPassword}
            <input
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </label>
          <label>
            {strings.dataReset.repeatPassword}
            <input
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </label>
        </div>
        {passwordFormError && <div className="alert error">{passwordFormError}</div>}
        {passwordFormOk && <div className="alert success">{passwordFormOk}</div>}
        <button
          type="button"
          className="btn-secondary"
          disabled={passwordBusy}
          onClick={() => void savePassword()}
        >
          {passwordConfigured ? strings.dataReset.changePassword : strings.dataReset.setPassword}
        </button>
      </section>

      <section className="section">
        <h2>{strings.dataReset.selectOperation}</h2>
        <div className="operation-cards">
          {scopes.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`operation-card ${scope === item.id ? 'selected' : ''}`}
              onClick={() => setScope(item.id)}
            >
              <div className="operation-card-title">{item.title}</div>
              <div className={`risk-chip ${item.riskClass}`}>
                {strings.dataReset.riskLabel}: {item.risk}
              </div>
              <p className="muted">{item.hint}</p>
            </button>
          ))}
        </div>
        <button
          type="button"
          className="btn-primary"
          disabled={!canPreview}
          onClick={() => void runPreview()}
        >
          {previewBusy ? strings.dataReset.previewLoading : strings.dataReset.preview}
        </button>
        {previewError && (
          <div className="alert error section-error">
            {previewError}
            <button type="button" className="btn-secondary" onClick={() => void runPreview()}>
              {strings.common.retry}
            </button>
          </div>
        )}
      </section>

      {preview && (
        <section className="card section preview-card">
          <h2>{strings.dataReset.previewTitle}</h2>
          <p className="muted">
            {strings.dataReset.previewGeneratedAt}:{' '}
            {preview.generatedAt ? formatDateTime(preview.generatedAt) : strings.common.dash}
          </p>
          <p>
            {strings.dataReset.previewScope}: <strong>{scopeTitle}</strong>
          </p>
          <h3>{strings.dataReset.willDelete}</h3>
          <div className="grid cards metric-cards">
            {COUNT_KEYS.map(({ key, labelKey }) => (
              <div className="card metric-card" key={key}>
                <div className="label">{String(strings.dataReset[labelKey])}</div>
                <div className="value">{preview.counts?.[key] ?? 0}</div>
              </div>
            ))}
          </div>

          {preview.preserved && preview.preserved.length > 0 && (
            <>
              <h3>{strings.dataReset.willRemain}</h3>
              <ul className="remain-list">
                {preview.preserved.map((item) => (
                  <li key={item}>{preservedLabel(item)}</li>
                ))}
              </ul>
            </>
          )}

          <button
            type="button"
            className="btn-secondary"
            onClick={() => setDetailsOpen((open) => !open)}
          >
            {detailsOpen ? strings.dataReset.hideDetails : strings.dataReset.showDetails}
          </button>
          {detailsOpen && (
            <div className="details-table-wrap">
              {(preview.samples ?? []).length === 0 ? (
                <p className="muted">{strings.common.noData}</p>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>{strings.dataReset.detailTable}</th>
                      <th>{strings.dataReset.detailLabel}</th>
                      <th>{strings.dataReset.detailId}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(preview.samples ?? []).map((row) => (
                      <tr key={`${row.table}-${row.id}`}>
                        <td>{row.table}</td>
                        <td>{row.label ?? strings.common.dash}</td>
                        <td className="mono">{row.id}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {!passwordConfigured && (
            <div className="alert warn">{strings.dataReset.executeDisabledNoPassword}</div>
          )}

          {canShowExecuteForm && (
            <div className="execute-panel">
              <p className="muted">
                {strings.dataReset.confirmationVisible}{' '}
                <strong className="mono">{strings.dataReset.confirmationPhrase}</strong>
              </p>
              <div className="form-grid">
                <label>
                  {strings.dataReset.resetPassword}
                  <input
                    type="password"
                    value={resetPassword}
                    onChange={(e) => setResetPassword(e.target.value)}
                    autoComplete="off"
                  />
                </label>
                <label>
                  {strings.dataReset.confirmationHint}
                  <input
                    value={confirmationPhrase}
                    onChange={(e) => setConfirmationPhrase(e.target.value)}
                    autoComplete="off"
                  />
                </label>
              </div>
              <button type="button" className="btn-danger" disabled>
                {executeLabel}
              </button>
              <p className="muted">
                {executeBlockedReason || strings.dataReset.executeGateNote}
              </p>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
