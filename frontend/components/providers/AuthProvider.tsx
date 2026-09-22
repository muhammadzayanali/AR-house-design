"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { api, getToken, setToken } from "@/lib/api";
import type { AuthUser } from "@/lib/types";

type AuthContextValue = {
  user: AuthUser | null;
  ready: boolean;
  login: (token: string, user: AuthUser) => void;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  // Ready immediately when no token; otherwise wait for /me/
  const [ready, setReady] = useState(() => !getToken());

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    let cancelled = false;
    api<AuthUser>("/api/auth/me/")
      .then((u) => {
        if (!cancelled) setUser(u);
      })
      .catch(() => {
        if (!cancelled) setToken(null);
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback((token: string, next: AuthUser) => {
    setToken(token);
    setUser(next);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api("/api/auth/logout/", { method: "POST" });
    } catch {
      // token may already be invalid
    }
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, ready, login, logout }),
    [user, ready, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
