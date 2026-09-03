import { FormEvent, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import * as authApi from '../api/auth';
import {
  fetchTelegramStatus,
  startTelegramRebind,
  verifyTelegramRebind,
  disconnectTelegramAdmin,
} from '../api/admin';
import { tokenStore } from '../api/client';
import { getErrorMessage } from '../api/client';
import { formatDateTime, labelAdminActive, labelRole, t } from '../i18n';

export function ProfilePage() {
  const strings = t();
  const { admin, logout } = useAuth();
  const location = useLocation();
  const [telegram, setTelegram] = useState<Awaited<ReturnType<typeof fetchTelegramStatus>> | null>(null);
  const [sessions, setSessions] = useState<Awaited<ReturnType<typeof authApi.fetchSessions>>>([]);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [disconnectPassword, setDisconnectPassword] = useState('');
  const [rebindPassword, setRebindPassword] = useState('');
  const [rebindOtp, setRebindOtp] = useState('');
  const [rebindLink, setRebindLink] = useState<{ deepLink: string | null; expiresAt: string } | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const loadTelegram = () => {
    fetchTelegramStatus().then(setTelegram).catch(() => undefined);
  };

  const loadSessions = () => {
    const refresh = tokenStore.getRefresh() ?? undefined;
    authApi.fetchSessions(refresh).then(setSessions).catch(() => undefined);
  };

  useEffect(() => {
    loadTelegram();
    loadSessions();
  }, []);

  useEffect(() => {
    const hash = location.hash.replace('#', '');
    if (!hash) return;
    const el = document.getElementById(hash);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [location.hash]);

  async function onChangePassword(e: FormEvent) {
    e.preventDefault();
    setError('');
    setMessage('');
    if (newPassword !== confirmPassword) {
      setError(strings.profile.passwordMismatch);
      return;
    }
    setBusy(true);
    try {
      await authApi.changePassword(currentPassword, newPassword);
      setMessage(strings.profile.passwordChanged);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(getErrorMessage(err, strings.errors.changePassword));
    } finally {
      setBusy(false);
    }
  }

  async function onStartRebind(e: FormEvent) {
    e.preventDefault();
    setError('');
    setMessage('');
    setBusy(true);
    try {
      const result = await startTelegramRebind(rebindPassword);
      setRebindLink({ deepLink: result.deepLink, expiresAt: result.expiresAt });
      setRebindPassword('');
      setMessage(strings.profile.telegramRebindStarted);
    } catch (err) {
      setError(getErrorMessage(err, strings.errors.telegramRebind));
    } finally {
      setBusy(false);
    }
  }

  async function onDisconnectTelegram(e: FormEvent) {
    e.preventDefault();
    setError('');
    setMessage('');
    setBusy(true);
    try {
      const status = await disconnectTelegramAdmin(disconnectPassword);
      setTelegram((prev) => ({
        ...prev,
        ...status,
        firstName: null,
        lastSeenAt: prev?.lastSeenAt ?? null,
        username: null,
        verifiedAt: null,
      }));
      setDisconnectPassword('');
      setMessage(strings.profile.telegramDisconnected);
    } catch (err) {
      setError(getErrorMessage(err, strings.errors.telegramRebind));
    } finally {
      setBusy(false);
    }
  }

  async function onVerifyRebind(e: FormEvent) {
    e.preventDefault();
    setError('');
    setMessage('');
    setBusy(true);
    try {
      const status = await verifyTelegramRebind(rebindOtp);
      setTelegram((prev) => ({ ...prev, ...status, firstName: prev?.firstName ?? null, lastSeenAt: prev?.lastSeenAt ?? null }));
      setRebindOtp('');
      setRebindLink(null);
      setMessage(strings.profile.telegramRebindDone);
    } catch (err) {
      setError(getErrorMessage(err, strings.errors.telegramRebind));
    } finally {
      setBusy(false);
    }
  }

  async function onRevokeSessions() {
    setError('');
    setMessage('');
    setBusy(true);
    try {
      const count = await authApi.revokeOtherSessions(tokenStore.getRefresh() ?? undefined);
      loadSessions();
      setMessage(strings.profile.sessionsRevoked(count));
    } catch (err) {
      setError(getErrorMessage(err, strings.errors.sessions));
    } finally {
      setBusy(false);
    }
  }

  if (!admin) return <p>{strings.common.loading}</p>;

  const telegramLabel = telegram?.username
    ? `@${telegram.username}`
    : telegram?.telegramUserId ?? strings.common.dash;

  return (
    <div className="profile-page">
      <h1>{strings.profile.title}</h1>

      {message && <div className="alert success">{message}</div>}
      {error && <div className="alert error">{error}</div>}

      <section id="account" className="card section profile-section">
        <h2>{strings.profile.accountSection}</h2>
        <dl className="profile-dl">
          <div>
            <dt>{strings.profile.email}</dt>
            <dd>{admin.email}</dd>
          </div>
          <div>
            <dt>{strings.profile.roles}</dt>
            <dd>{admin.roles.map(labelRole).join(', ')}</dd>
          </div>
          <div>
            <dt>{strings.profile.status}</dt>
            <dd>{labelAdminActive(admin.isActive)}</dd>
          </div>
          <div>
            <dt>{strings.profile.created}</dt>
            <dd>{formatDateTime(admin.createdAt)}</dd>
          </div>
        </dl>
      </section>

      <section id="security" className="card section profile-section">
        <h2>{strings.profile.securitySection}</h2>
        <h3>{strings.profile.changePassword}</h3>
        <form className="form-stack" onSubmit={onChangePassword}>
          <label>
            {strings.profile.currentPassword}
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </label>
          <label>
            {strings.profile.newPassword}
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={12}
              required
              autoComplete="new-password"
            />
          </label>
          <label>
            {strings.profile.confirmPassword}
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={12}
              required
              autoComplete="new-password"
            />
          </label>
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? strings.profile.updating : strings.profile.updatePassword}
          </button>
        </form>

        <h3>{strings.profile.sessionsTitle}</h3>
        {sessions.length === 0 ? (
          <p className="muted">{strings.profile.sessionsEmpty}</p>
        ) : (
          <ul className="session-list">
            {sessions.map((session) => (
              <li key={session.id} className={session.isCurrent ? 'current' : ''}>
                <div>
                  {session.userAgent ?? strings.profile.unknownDevice}
                  {session.isCurrent && (
                    <span className="chip chip-ok">{strings.profile.currentSession}</span>
                  )}
                </div>
                <div className="muted">
                  {formatDateTime(session.createdAt)}
                  {session.ipAddress ? ` · ${session.ipAddress}` : ''}
                </div>
              </li>
            ))}
          </ul>
        )}
        <button type="button" className="btn-secondary" disabled={busy} onClick={() => void onRevokeSessions()}>
          {strings.profile.revokeOtherSessions}
        </button>
      </section>

      <section id="telegram" className="card section profile-section">
        <h2>{strings.profile.telegramSection}</h2>
        <dl className="profile-dl">
          <div>
            <dt>{strings.profile.telegramAccount}</dt>
            <dd>{telegramLabel}</dd>
          </div>
          <div>
            <dt>{strings.profile.telegramStatus}</dt>
            <dd>
              {telegram?.connected ? (
                <span className="chip chip-ok">{strings.profile.telegramConnected}</span>
              ) : (
                <span className="chip">{strings.profile.telegramNotConnected}</span>
              )}
            </dd>
          </div>
          {telegram?.verifiedAt && (
            <div>
              <dt>{strings.profile.telegramLinkedAt}</dt>
              <dd>{formatDateTime(telegram.verifiedAt)}</dd>
            </div>
          )}
        </dl>

        {telegram?.connected && (
          <details className="rebind-panel">
            <summary>{strings.profile.telegramDisconnect}</summary>
            <p className="muted">{strings.profile.telegramDisconnectHint}</p>
            <form className="form-stack" onSubmit={onDisconnectTelegram}>
              <label>
                {strings.profile.currentPassword}
                <input
                  type="password"
                  value={disconnectPassword}
                  onChange={(e) => setDisconnectPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </label>
              <button type="submit" className="btn-danger" disabled={busy}>
                {strings.profile.telegramDisconnect}
              </button>
            </form>
          </details>
        )}

        <details className="rebind-panel">
          <summary>{telegram?.connected ? strings.profile.telegramChange : strings.profile.telegramStartRebind}</summary>
          <p className="muted">{strings.profile.telegramRebindHint}</p>
          {!rebindLink ? (
            <form className="form-stack" onSubmit={onStartRebind}>
              <label>
                {strings.profile.currentPassword}
                <input
                  type="password"
                  value={rebindPassword}
                  onChange={(e) => setRebindPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </label>
              <button type="submit" className="btn-primary" disabled={busy}>
                {strings.profile.telegramStartRebind}
              </button>
            </form>
          ) : (
            <div className="form-stack">
              <p>{strings.profile.telegramOpenBot}</p>
              {rebindLink.deepLink && (
                <a className="btn-secondary" href={rebindLink.deepLink} target="_blank" rel="noreferrer">
                  {strings.profile.openBot}
                </a>
              )}
              <form onSubmit={onVerifyRebind}>
                <label>
                  {strings.profile.telegramOtp}
                  <input
                    inputMode="numeric"
                    pattern="\d{6}"
                    maxLength={6}
                    value={rebindOtp}
                    onChange={(e) => setRebindOtp(e.target.value)}
                    required
                  />
                </label>
                <button type="submit" className="btn-primary" disabled={busy}>
                  {strings.profile.telegramConfirmRebind}
                </button>
              </form>
            </div>
          )}
        </details>
      </section>

      <div className="profile-logout">
        <button type="button" className="btn-danger" onClick={() => void logout()}>
          {strings.profile.logoutAccount}
        </button>
      </div>
    </div>
  );
}
