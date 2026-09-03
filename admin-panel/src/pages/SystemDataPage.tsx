import { useEffect, useState } from 'react';
import {
  changeResetPassword,
  dataResetDryRun,
  executeDataReset,
  fetchResetPasswordStatus,
  initializeResetPassword,
} from '../api/admin';
import { getErrorMessage } from '../api/client';
import { useStrings } from '../context/LocaleContext';

type Scope = 'TEST_DATA_CLEANUP' | 'USER_DATA_RESET' | 'FACTORY_RESET';

export function SystemDataPage() {
  const strings = useStrings();
  const [passwordStatus, setPasswordStatus] = useState<{ configured: boolean } | null>(null);
  const [scope, setScope] = useState<Scope>('USER_DATA_RESET');
  const [dryRun, setDryRun] = useState<Record<string, number> | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [confirmationPhrase, setConfirmationPhrase] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [result, setResult] = useState<Record<string, number> | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const loadPasswordStatus = () => {
    fetchResetPasswordStatus()
      .then(setPasswordStatus)
      .catch((err) => setError(getErrorMessage(err, strings.errors.generic)));
  };

  useEffect(() => {
    loadPasswordStatus();
  }, []);

  const runDryRun = async () => {
    setBusy(true);
    setError('');
    try {
      const response = await dataResetDryRun(scope);
      setDryRun(response.counts as Record<string, number>);
      setResult(null);
    } catch (err) {
      setError(getErrorMessage(err, strings.errors.generic));
    } finally {
      setBusy(false);
    }
  };

  const runExecute = async () => {
    setBusy(true);
    setError('');
    try {
      const response = await executeDataReset({
        scope,
        resetPassword,
        confirmationPhrase,
      });
      setResult(response.afterCounts as Record<string, number>);
      setDryRun(null);
    } catch (err) {
      setError(getErrorMessage(err, strings.errors.generic));
    } finally {
      setBusy(false);
    }
  };

  const savePassword = async () => {
    setBusy(true);
    setError('');
    try {
      if (passwordStatus?.configured) {
        await changeResetPassword({ currentPassword, newPassword, confirmPassword });
      } else {
        await initializeResetPassword({ newPassword, confirmPassword });
      }
      loadPasswordStatus();
      setNewPassword('');
      setConfirmPassword('');
      setCurrentPassword('');
    } catch (err) {
      setError(getErrorMessage(err, strings.errors.generic));
    } finally {
      setBusy(false);
    }
  };

  const canExecute =
    dryRun &&
    resetPassword.length > 0 &&
    confirmationPhrase.trim() === strings.dataReset.confirmationPhrase;

  return (
    <div>
      <h1>{strings.dataReset.title}</h1>
      <p className="muted">{strings.dataReset.subtitle}</p>
      {error && <div className="alert error">{error}</div>}

      <section className="card section">
        <h2>{strings.dataReset.passwordStatus}</h2>
        <p>
          {passwordStatus?.configured
            ? strings.dataReset.passwordConfigured
            : strings.dataReset.passwordNotConfigured}
        </p>
        <div className="form-grid">
          {passwordStatus?.configured && (
            <label>
              {strings.profile.currentPassword}
              <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
            </label>
          )}
          <label>
            {strings.profile.newPassword}
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </label>
          <label>
            {strings.dataReset.repeatPassword}
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          </label>
        </div>
        <button type="button" className="btn-secondary" disabled={busy} onClick={() => void savePassword()}>
          {passwordStatus?.configured ? strings.dataReset.changePassword : strings.dataReset.setPassword}
        </button>
      </section>

      <section className="card section">
        <h2>{strings.system.dataManagement}</h2>
        <div className="form-grid">
          <label>
            {strings.dataReset.scopeLabel}
            <select value={scope} onChange={(e) => setScope(e.target.value as Scope)}>
              <option value="TEST_DATA_CLEANUP">{strings.dataReset.scopeTest}</option>
              <option value="USER_DATA_RESET">{strings.dataReset.scopeUser}</option>
              <option value="FACTORY_RESET">{strings.dataReset.scopeFactory}</option>
            </select>
          </label>
        </div>
        <button type="button" className="btn-secondary" disabled={busy} onClick={() => void runDryRun()}>
          {strings.dataReset.dryRun}
        </button>

        {dryRun && (
          <div className="section">
            <h3>{strings.dataReset.willDelete}</h3>
            <ul>
              <li>{strings.dataReset.users}: {dryRun.users ?? 0}</li>
              <li>{strings.dataReset.devices}: {dryRun.devices ?? 0}</li>
              <li>{strings.dataReset.licenses}: {dryRun.licenses ?? 0}</li>
              <li>{strings.dataReset.activations}: {dryRun.activations ?? 0}</li>
              <li>{strings.dataReset.telegram}: {dryRun.telegramAccounts ?? 0}</li>
              <li>{strings.dataReset.orders}: {dryRun.orders ?? 0}</li>
              <li>{strings.dataReset.receipts}: {dryRun.receipts ?? 0}</li>
              <li>{strings.dataReset.support}: {dryRun.supportConversations ?? 0}</li>
            </ul>
            <label>
              {strings.dataReset.resetPassword}
              <input type="password" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} />
            </label>
            <label>
              {strings.dataReset.confirmationHint}
              <input value={confirmationPhrase} onChange={(e) => setConfirmationPhrase(e.target.value)} />
            </label>
            <button
              type="button"
              className="btn-danger"
              disabled={!canExecute || busy}
              onClick={() => void runExecute()}
            >
              {busy ? strings.dataReset.executing : strings.dataReset.execute}
            </button>
          </div>
        )}

        {result && (
          <div className="alert success section">
            <h3>{strings.dataReset.completed}</h3>
            <ul>
              <li>{strings.dataReset.users}: {result.users ?? 0}</li>
              <li>{strings.dataReset.devices}: {result.devices ?? 0}</li>
              <li>{strings.dataReset.licenses}: {result.licenses ?? 0}</li>
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
