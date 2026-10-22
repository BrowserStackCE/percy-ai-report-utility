import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { clearCredentials, readCredentials, writeCredentials, type StoredCredentials } from "./cookies";

interface AuthState {
  credentials: StoredCredentials;
  hasPercy: boolean;
  hasBrowserStack: boolean;
  isAuthenticated: boolean;
  /** Merge already-validated credentials into the cookie. */
  save: (creds: StoredCredentials) => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [credentials, setCredentials] = useState<StoredCredentials>(() => readCredentials());

  const save = useCallback((creds: StoredCredentials) => {
    setCredentials((prev) => {
      const next = { ...prev, ...creds };
      writeCredentials(next);
      return next;
    });
  }, []);

  const signOut = useCallback(() => {
    clearCredentials();
    setCredentials({});
  }, []);

  const value = useMemo<AuthState>(() => {
    const hasPercy = Boolean(credentials.percyToken);
    const hasBrowserStack = Boolean(credentials.username && credentials.accessKey);
    return { credentials, hasPercy, hasBrowserStack, isAuthenticated: hasPercy || hasBrowserStack, save, signOut };
  }, [credentials, save, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
