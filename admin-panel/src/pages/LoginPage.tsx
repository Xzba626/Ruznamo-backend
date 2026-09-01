import { FormEvent, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { getErrorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { t } from '../i18n';

export function LoginPage() {
  const strings = t();
  const { admin, login, loading } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!loading && admin) return <Navigate to="/" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(username.trim(), password);
    } catch (err) {
      setError(getErrorMessage(err, strings.errors.authFailed));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={onSubmit}>
        <h1>{strings.login.title}</h1>
        <p className="muted">{strings.login.subtitle}</p>
        {error && <div className="alert error">{error}</div>}
        <label>
          {strings.login.username}
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
        </label>
        <label>
          {strings.login.password}
          <div className="password-row">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
            <button type="button" className="btn-secondary" onClick={() => setShowPassword((v) => !v)}>
              {showPassword ? strings.common.hide : strings.common.show}
            </button>
          </div>
        </label>
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? strings.login.submitting : strings.login.submit}
        </button>
      </form>
    </div>
  );
}
