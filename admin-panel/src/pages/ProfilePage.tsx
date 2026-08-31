import { FormEvent, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import * as authApi from '../api/auth';
import { fetchTelegramStatus } from '../api/admin';
import { ApiClientError } from '../api/client';

export function ProfilePage() {
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
      setMessage('Password changed. Please sign in again.');
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to change password');
    } finally {
      setSubmitting(false);
    }
  }

  if (!admin) return <p>Loading…</p>;

  return (
    <div>
      <h1>Profile</h1>
      <div className="card section">
        <p><strong>Username:</strong> {admin.email}</p>
        <p><strong>Display name:</strong> {admin.displayName ?? '—'}</p>
        <p><strong>Roles:</strong> {admin.roles.join(', ')}</p>
        <p><strong>Status:</strong> {admin.isActive ? 'Active' : 'Inactive'}</p>
        <p><strong>Created:</strong> {new Date(admin.createdAt).toLocaleString()}</p>
        <p><strong>Last login:</strong> {admin.lastLoginAt ? new Date(admin.lastLoginAt).toLocaleString() : '—'}</p>
        <p><strong>Telegram:</strong> {telegram?.isVerified ? 'Connected' : 'Not connected'}</p>
      </div>
      <section className="section">
        <h2>Change password</h2>
        {message && <div className="alert success">{message}</div>}
        {error && <div className="alert error">{error}</div>}
        <form className="form-stack" onSubmit={onChangePassword}>
          <label>
            Current password
            <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
          </label>
          <label>
            New password
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={12} required />
          </label>
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </section>
    </div>
  );
}
