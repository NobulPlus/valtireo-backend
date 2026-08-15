import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, ApiError, getStoredToken, onUnauthorized, onWorkspaceSuspended, setStoredToken } from '@/lib/apiClient';
import type { EntitledModule, LoginResponse, SessionPayload } from '@/types/api';

interface AuthContextValue {
  isLoading: boolean;
  isAuthenticated: boolean;
  session: SessionPayload | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  hasAnyRole: (roles: string[]) => boolean;
  moduleByKey: (key: string) => EntitledModule | undefined;
  /** Best default landing route for the current user's roles/permissions. */
  defaultRoute: string;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const ORG_LEVEL_ROLES = [
  'Organization Admin',
  'HR Director',
  'HR Officer',
  'Compliance Officer',
  'ICT Admin',
];

const MANAGER_ROLES = ['Department Head', 'Supervisor'];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const clearSession = useCallback(() => {
    setStoredToken(null);
    setSession(null);
  }, []);

  const bootstrap = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setIsLoading(false);
      return;
    }

    try {
      const payload = await api.get<SessionPayload>('/auth/me');
      setSession(payload);
    } catch (error) {
      if (error instanceof ApiError && error.status !== 401) {
        // Network/server issue: keep the token, let the user retry rather
        // than silently signing them out.
        console.error('Failed to bootstrap session', error);
      } else {
        clearSession();
      }
    } finally {
      setIsLoading(false);
    }
  }, [clearSession]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  useEffect(() => onUnauthorized(clearSession), [clearSession]);

  const login = useCallback(async (email: string, password: string) => {
    const payload = await api.post<LoginResponse>('/auth/login', {
      email,
      password,
      device_name: 'valtireo-web',
    });
    setStoredToken(payload.token);
    setSession(payload);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignore network errors on logout; we clear local state regardless.
    } finally {
      clearSession();
    }
  }, [clearSession]);

  useEffect(() => onWorkspaceSuspended(clearSession), [clearSession]);

  const hasPermission = useCallback(
    (permission: string) => session?.permissions.includes(permission) ?? false,
    [session],
  );

  const hasAnyRole = useCallback(
    (roles: string[]) => (session ? session.roles.some((role) => roles.includes(role)) : false),
    [session],
  );

  const moduleByKey = useCallback(
    (key: string) => session?.modules.find((module) => module.key === key),
    [session],
  );

  const defaultRoute = useMemo(() => {
    if (!session) return '/login';
    if (hasAnyRole(['Super Admin'])) return '/platform';
    if (hasAnyRole(ORG_LEVEL_ROLES) && hasPermission('reports.view')) return '/dashboard/organization';
    if (hasAnyRole(MANAGER_ROLES)) return '/dashboard/manager';
    return '/dashboard/me';
  }, [session, hasAnyRole, hasPermission]);

  const value = useMemo<AuthContextValue>(
    () => ({
      isLoading,
      isAuthenticated: Boolean(session),
      session,
      login,
      logout,
      refresh: bootstrap,
      hasPermission,
      hasAnyRole,
      moduleByKey,
      defaultRoute,
    }),
    [isLoading, session, login, logout, bootstrap, hasPermission, hasAnyRole, moduleByKey, defaultRoute],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
