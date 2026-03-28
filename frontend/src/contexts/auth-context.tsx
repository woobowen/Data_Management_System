import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { ApiClientError, loginUser, registerUser, setAuthToken, type AuthUser } from '../lib/api';

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isBootstrapping: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => void;
  error: string | null;
  clearError: () => void;
};

const STORAGE_KEY = 'survey-system-auth';
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      setIsBootstrapping(false);
      return;
    }

    try {
      const parsed = JSON.parse(raw) as { token: string; user: AuthUser };
      setUser(parsed.user);
      setToken(parsed.token);
      setAuthToken(parsed.token);
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    } finally {
      setIsBootstrapping(false);
    }
  }, []);

  const persist = (nextToken: string, nextUser: AuthUser) => {
    setToken(nextToken);
    setUser(nextUser);
    setAuthToken(nextToken);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: nextToken, user: nextUser }));
  };

  const login = async (username: string, password: string) => {
    setError(null);
    try {
      const data = await loginUser(username, password);
      persist(data.token, data.user);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : '登录失败');
      throw err;
    }
  };

  const register = async (username: string, password: string) => {
    setError(null);
    try {
      await registerUser(username, password);
      await login(username, password);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : '注册失败');
      throw err;
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setError(null);
    setAuthToken(null);
    window.localStorage.removeItem(STORAGE_KEY);
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isAuthenticated: !!token,
      isBootstrapping,
      login,
      register,
      logout,
      error,
      clearError: () => setError(null),
    }),
    [user, token, isBootstrapping, error],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
