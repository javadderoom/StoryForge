'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export interface UserProfile {
  id: string;
  phoneNumber: string;
  name: string | null;
  role: string;
  creditBalance: number;
  phoneVerified: boolean;
}

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (phoneNumber: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (phoneNumber: string, password: string, name?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
  updateCreditBalance: (newBalance: number) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_STORAGE_KEY = 'storyforge_auth_token';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    try {
      const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
      if (!storedToken) {
        setUser(null);
        setToken(null);
        setIsLoading(false);
        return;
      }

      const res = await fetch('/api/auth/me', {
        headers: {
          Authorization: `Bearer ${storedToken}`,
        },
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success && json.user) {
          setUser(json.user);
          setToken(storedToken);
        } else {
          localStorage.removeItem(TOKEN_STORAGE_KEY);
          setUser(null);
          setToken(null);
        }
      } else {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        setUser(null);
        setToken(null);
      }
    } catch {
      // Network error
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  const login = async (phoneNumber: string, password: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber, password }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        localStorage.setItem(TOKEN_STORAGE_KEY, json.token);
        setToken(json.token);
        setUser(json.user);
        return { success: true };
      }
      return { success: false, error: json.error || 'ورود ناموفق بود.' };
    } catch (e: any) {
      return { success: false, error: e.message || 'خطا در برقراری ارتباط.' };
    }
  };

  const register = async (phoneNumber: string, password: string, name?: string) => {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber, password, name }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        localStorage.setItem(TOKEN_STORAGE_KEY, json.token);
        setToken(json.token);
        setUser(json.user);
        return { success: true };
      }
      return { success: false, error: json.error || 'ثبت‌نام ناموفق بود.' };
    } catch (e: any) {
      return { success: false, error: e.message || 'خطا در برقراری ارتباط.' };
    }
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    setUser(null);
    setToken(null);
  };

  const updateCreditBalance = (newBalance: number) => {
    setUser((prev) => (prev ? { ...prev, creditBalance: newBalance } : null));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        refreshProfile,
        updateCreditBalance,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
