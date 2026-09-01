import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { t } from '../i18n';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { admin, loading } = useAuth();
  const location = useLocation();
  const strings = t();

  if (loading) {
    return (
      <div className="login-page">
        <p>{strings.common.loadingSession}</p>
      </div>
    );
  }
  if (!admin) return <Navigate to="/login" replace state={{ from: location }} />;
  return children;
}
