import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import * as authApi from '../api/auth';
import type { AdminProfile } from '../api/types';
import { tokenStore } from '../api/client';

interface AuthState {
  admin: AdminProfile | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<AdminProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    if (!tokenStore.getAccess()) {
      setAdmin(null);
      return;
    }
    const profile = await authApi.fetchMe();
    setAdmin(profile);
  }, []);

  useEffect(() => {
    refreshProfile()
      .catch(() => {
        tokenStore.clear();
        setAdmin(null);
      })
      .finally(() => setLoading(false));
  }, [refreshProfile]);

  const login = useCallback(async (username: string, password: string) => {
    const profile = await authApi.login(username, password);
    setAdmin(profile);
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setAdmin(null);
    }
  }, []);

  const hasPermission = useCallback(
    (permission: string) => admin?.permissions.includes(permission) ?? false,
    [admin],
  );

  const value = useMemo(
    () => ({ admin, loading, login, logout, refreshProfile, hasPermission }),
    [admin, loading, login, logout, refreshProfile, hasPermission],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
