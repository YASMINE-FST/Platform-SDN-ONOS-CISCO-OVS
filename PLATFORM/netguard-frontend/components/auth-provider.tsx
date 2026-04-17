'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

interface User {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'manager' | 'viewer';
  mfa_enabled: boolean;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (credentials: {
    identifier: string;
    password: string;
    rememberMe: boolean;
  }) => Promise<{ mfa_required: boolean; mfa_token?: string }>;
  verifyMfa: (mfa_token: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

const storage = {
  getAccess: () => sessionStorage.getItem('access_token'),
  getRefresh: () =>
    localStorage.getItem('refresh_token') ||
    sessionStorage.getItem('refresh_token'),
  setTokens: (access: string, refresh: string, remember: boolean) => {
    sessionStorage.setItem('access_token', access);
    if (remember) localStorage.setItem('refresh_token', refresh);
    else sessionStorage.setItem('refresh_token', refresh);
  },
  clear: () => {
    sessionStorage.removeItem('access_token');
    sessionStorage.removeItem('refresh_token');
    localStorage.removeItem('refresh_token');
  },
};

async function apiFetch(path: string, options: RequestInit = {}) {
  return fetch(`${API_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
}

async function fetchMe(token: string): Promise<User> {
  const res = await apiFetch('/users/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch user');
  return res.json();
}

async function doRefresh(): Promise<string | null> {
  const refresh = storage.getRefresh();
  if (!refresh) return null;
  const res = await apiFetch('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refresh_token: refresh }),
  });
  if (!res.ok) { storage.clear(); return null; }
  const data = await res.json();
  storage.setTokens(data.access_token, data.refresh_token, true);
  return data.access_token;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        let token = storage.getAccess();
        if (!token) token = await doRefresh();
        if (token) setUser(await fetchMe(token));
      } catch {
        storage.clear();
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const login = async (credentials: {
    identifier: string;
    password: string;
    rememberMe: boolean;
  }) => {
    const res = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Authentication failed');

    if (data.mfa_required) {
      return { mfa_required: true, mfa_token: data.mfa_token };
    }

    storage.setTokens(data.access_token, data.refresh_token, credentials.rememberMe);
    setUser(await fetchMe(data.access_token));
    return { mfa_required: false };
  };

  const verifyMfa = async (mfa_token: string, code: string) => {
    const res = await apiFetch('/auth/mfa/verify', {
      method: 'POST',
      body: JSON.stringify({ mfa_token, code }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Invalid MFA code');
    storage.setTokens(data.access_token, data.refresh_token, true);
    setUser(await fetchMe(data.access_token));
  };

  const logout = async () => {
    const refresh = storage.getRefresh();
    if (refresh) {
      await apiFetch('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refresh_token: refresh }),
      });
    }
    storage.clear();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, verifyMfa, logout }}>
      {children}
    </AuthContext.Provider>
  );
}