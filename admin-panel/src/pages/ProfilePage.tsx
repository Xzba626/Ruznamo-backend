import { FormEvent, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import * as authApi from '../api/auth';
import { fetchTelegramStatus } from '../api/admin';
import { getErrorMessage } from '../api/client';
import { formatDateTime, labelAdminActive, labelRole, labelTelegramConnected, t } from '../i18n';

export function ProfilePage() {
  const strings = t();
  const { admin } = useAuth();
  const [telegram, setTelegram] = useState<Awaited<ReturnType<typeof fetchTelegramStatus>> | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchTelegramStatus().then(setTelegram).catch(() => undefined);
  }, []);

  async function onChangePassword(e: FormEvent) {
    e.preventDefault();
    setError('');
    setMessage('');
    setSubmitting(true);
    try {
      await authApi.changePassword(currentPassword, newPassword);
      setMessage(strings.profile.passwordChanged);
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      setError(getErrorMessage(err, strings.errors.changePassword));
    } finally {
      setSubmitting(false);
    }
  }

  if (!admin) return <p>{strings.common.loading}</p>;

  return (
    <div>
      <h1>{strings.profile.title}</h1>
      <div className="card section">
        <p><strong>{strings.profile.username}:</strong> {admin.email}</p>
        <p><strong>{strings.profile.displayName}:</strong> {admin.displayName ?? strings.common.dash}</p>
        <p><strong>{strings.profile.roles}:</strong> {admin.roles.map(labelRole).join(', ')}</p>
        <p><strong>{strings.profile.status}:</strong> {labelAdminActive(admin.isActive)}</p>
        <p><strong>{strings.profile.created}:</strong> {formatDateTime(admin.createdAt)}</p>
        <p><strong>{strings.profile.lastLogin}:</strong> {admin.lastLoginAt ? formatDateTime(admin.lastLoginAt) : strings.common.dash}</p>
        <p><strong>{strings.profile.telegram}:</strong> {labelTelegramConnected(Boolean(telegram?.isVerified))}</p>
      </div>
      <section className="section">
        <h2>{strings.profile.changePassword}</h2>
        {message && <div className="alert success">{message}</div>}
        {error && <div className="alert error">{error}</div>}
        <form className="form-stack" onSubmit={onChangePassword}>
          <label>
            {strings.profile.currentPassword}
            <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
          </label>
          <label>
            {strings.profile.newPassword}
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={12} required />
          </label>
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? strings.profile.updating : strings.profile.updatePassword}
          </button>
        </form>
      </section>
    </div>
  );
}
