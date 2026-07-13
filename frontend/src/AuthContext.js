// Auth context — loads current session on mount, exposes login/signup/logout.
import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { authApi, setToken, clearToken } from "@/src/api";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const u = await authApi.me();
      setUser(u);
      return u;
    } catch (e) {
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    (async () => {
      await refresh();
      setLoading(false);
    })();
  }, [refresh]);

  const signup = async (email, password, displayName) => {
    const { token, user: u } = await authApi.signup(email, password, displayName);
    await setToken(token);
    setUser(u);
    return u;
  };

  const login = async (email, password) => {
    const { token, user: u } = await authApi.login(email, password);
    await setToken(token);
    setUser(u);
    return u;
  };

  const loginWithEmergent = async (session_token) => {
    const { token, user: u } = await authApi.emergent(session_token);
    await setToken(token);
    setUser(u);
    return u;
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {}
    await clearToken();
    setUser(null);
  };

  return (
    <AuthCtx.Provider value={{ user, loading, refresh, setUser, signup, login, loginWithEmergent, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
