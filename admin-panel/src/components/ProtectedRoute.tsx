import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { admin, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="login-page"><p>Loading session…</p></div>;
  if (!admin) return <Navigate to="/login" replace state={{ from: location }} />;
  return children;
}
