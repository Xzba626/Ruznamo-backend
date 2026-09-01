import { FormEvent, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import * as authApi from '../api/auth';
import { fetchTelegramStatus } from '../api/admin';
import { getErrorMessage } from '../api/client';
import { formatDateTime, labelAdminActive, labelRole, labelTelegramConnected, t } from '../i18n';

export function ProfilePage() {
  const strings = t();
  const { admin, setAdmin } = useAuth();
  const [telegram, setTelegram] = useState<Awaited<ReturnType<typeof fetchTelegramStatus>> | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [profileSubmitting, setProfileSubmitting] = useState(false);

  useEffect(() => {
    fetchTelegramStatus().then(setTelegram).catch(() => undefined);
  }, []);

  useEffect(() => {
    setDisplayName(admin?.displayName ?? '');
  }, [admin?.displayName]);

  async function onUpdateProfile(e: FormEvent) {
    e.preventDefault();
    setError('');
    setMessage('');
    setProfileSubmitting(true);
    try {
      const updated = await authApi.updateProfile(displayName.trim());
      setAdmin(updated);
      setMessage(strings.profile.profileUpdated);
    } catch (err) {
      setError(getErrorMessage(err, strings.errors.updateProfile));
    } finally {
      setProfileSubmitting(false);
    }
  }

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
        <p><strong>{strings.profile.roles}:</strong> {admin.roles.map(labelRole).join(', ')}</p>
        <p><strong>{strings.profile.status}:</strong> {labelAdminActive(admin.isActive)}</p>
        <p><strong>{strings.profile.created}:</strong> {formatDateTime(admin.createdAt)}</p>
        <p><strong>{strings.profile.lastLogin}:</strong> {admin.lastLoginAt ? formatDateTime(admin.lastLoginAt) : strings.common.dash}</p>
        <p><strong>{strings.profile.telegram}:</strong> {labelTelegramConnected(Boolean(telegram?.isVerified))}</p>
      </div>

      <section className="section">
        <h2>{strings.profile.displayName}</h2>
        {message && <div className="alert success">{message}</div>}
        {error && <div className="alert error">{error}</div>}
        <form className="form-stack" onSubmit={onUpdateProfile}>
          <label>
            {strings.profile.displayName}
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              minLength={1}
              maxLength={100}
              required
            />
          </label>
          <p className="muted">{strings.profile.displayNameHint}</p>
          <button type="submit" className="btn-primary" disabled={profileSubmitting}>
            {profileSubmitting ? strings.profile.savingProfile : strings.profile.saveProfile}
          </button>
        </form>
      </section>

      <section className="section">
        <h2>{strings.profile.changePassword}</h2>
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
