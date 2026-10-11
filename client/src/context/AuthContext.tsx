import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { api, ApiError, getStoredToken, onUnauthorized, onWorkspaceSuspended, setStoredToken } from '@/lib/apiClient';
import { onSessionChange } from '@/lib/sessionEvents';
import { queryClient } from '@/lib/queryClient';
import type { EntitledModule, LoginResponse, SessionPayload } from '@/types/api';

export type WorkspaceMode = 'admin' | 'employee';

interface AuthContextValue {
  isLoading: boolean;
  isAuthenticated: boolean;
  session: SessionPayload | null;
  /** Resolves to whether the freshly-signed-in user can choose a workspace mode — the caller can't rely on `canChooseWorkspaceMode` updating synchronously right after this resolves. */
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  moduleByKey: (key: string) => EntitledModule | undefined;
  /** Best default landing route for the current user's permissions/scope and workspace mode. */
  defaultRoute: string;
  /** Where "Dashboard" mode lands, regardless of the currently active mode — used by the mode picker/switcher. */
  adminLandingRoute: string;
  /** True for anyone with org-wide reporting access (`reports.view`) or manager scope over a team/department — able to choose between Dashboard and Employee module. */
  canChooseWorkspaceMode: boolean;
  /** null only while an eligible admin/manager hasn't picked a mode yet this session. Plain employees are always 'employee'. */
  workspaceMode: WorkspaceMode | null;
  setWorkspaceMode: (mode: WorkspaceMode) => void;
  /** Backend-computed: true only if the user is an employee AND holds `employees.view_team` — drives the Manager tab so it never shows when the API would 403. */
  hasManagerScope: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const WORKSPACE_MODE_STORAGE_KEY = 'valtireo.workspace_mode';

function normalizeSessionPayload<T extends Partial<SessionPayload>>(payload: T): T & SessionPayload {
  const user = payload.user ?? {
    id: 0,
    organization_id: null,
    name: 'User',
    email: '',
    email_verified_at: null,
    photo_url: null,
    created_at: '',
    updated_at: '',
  };

  return {
    ...payload,
    user,
    organization: payload.organization ?? null,
    workspace: payload.workspace ?? null,
    roles: Array.isArray(payload.roles) ? payload.roles : [],
    permissions: Array.isArray(payload.permissions) ? payload.permissions : [],
    modules: Array.isArray(payload.modules) ? payload.modules : [],
    has_manager_scope: Boolean(payload.has_manager_scope),
    is_platform_admin: Boolean(payload.is_platform_admin),
  } as T & SessionPayload;
}

function readStoredWorkspaceMode(): WorkspaceMode | null {
  const value = sessionStorage.getItem(WORKSPACE_MODE_STORAGE_KEY);
  return value === 'admin' || value === 'employee' ? value : null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [storedMode, setStoredMode] = useState<WorkspaceMode | null>(() => readStoredWorkspaceMode());

  const sessionGeneration = useRef(0);

  const clearSession = useCallback(() => {
    sessionGeneration.current += 1;
    setStoredToken(null);
    void queryClient.cancelQueries();
    queryClient.clear();
    setSession(null);
    sessionStorage.removeItem(WORKSPACE_MODE_STORAGE_KEY);
    setStoredMode(null);
  }, []);

  const bootstrap = useCallback(async () => {
    const generation = sessionGeneration.current;
    const token = getStoredToken();
    if (!token) {
      setIsLoading(false);
      return;
    }

    try {
      const payload = await api.get<SessionPayload>('/auth/me');
      if (generation !== sessionGeneration.current || token !== getStoredToken()) return;
      setSession(normalizeSessionPayload(payload));
    } catch (error) {
      if (generation !== sessionGeneration.current || token !== getStoredToken()) return;
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

  useEffect(() => onSessionChange(() => {
    sessionGeneration.current += 1;
    setSession(null);
    sessionStorage.removeItem(WORKSPACE_MODE_STORAGE_KEY);
    setStoredMode(null);
  }), []);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.storageArea === localStorage && (event.key === null || event.key === 'valtireo.auth_token')) {
        // Reset component state as well as cached queries when another tab signs in/out.
        window.location.reload();
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    clearSession();
    const generation = sessionGeneration.current;
    const payload = await api.post<LoginResponse>('/auth/login', {
      email,
      password,
      device_name: 'valtireo-web',
    });
    if (generation !== sessionGeneration.current) throw new ApiError('Sign-in was cancelled. Please retry.', 401);
    void queryClient.cancelQueries();
    queryClient.clear();
    setStoredToken(payload.token);
    const sessionPayload = normalizeSessionPayload(payload);
    setSession(sessionPayload);
    return sessionPayload.is_platform_admin || sessionPayload.permissions.includes('reports.view') || sessionPayload.has_manager_scope;
  }, [clearSession]);

  const logout = useCallback(async () => {
    const token = getStoredToken();
    clearSession();
    try {
      await api.post('/auth/logout', undefined, { headers: { Authorization: `Bearer ${token}` } });
    } catch {
      // Ignore network errors on logout; we clear local state regardless.
    }
  }, [clearSession]);

  useEffect(() => onWorkspaceSuspended(clearSession), [clearSession]);

  const hasPermission = useCallback(
    (permission: string) => session?.permissions?.includes(permission) ?? false,
    [session],
  );

  const moduleByKey = useCallback(
    (key: string) => session?.modules?.find((module) => module.key === key),
    [session],
  );

  const hasManagerScope = session?.has_manager_scope ?? false;
  const canChooseWorkspaceMode = hasPermission('reports.view') || hasManagerScope;
  const workspaceMode: WorkspaceMode | null = canChooseWorkspaceMode ? storedMode : 'employee';

  const setWorkspaceMode = useCallback((mode: WorkspaceMode) => {
    sessionStorage.setItem(WORKSPACE_MODE_STORAGE_KEY, mode);
    setStoredMode(mode);
  }, []);

  const adminLandingRoute = useMemo(() => {
    if (hasPermission('reports.view') && (hasPermission('employees.view_all') || hasPermission('organizations.administer'))) return '/dashboard/organization';
    if (hasManagerScope) return '/dashboard/manager';
    return '/dashboard/me';
  }, [hasPermission, hasManagerScope]);

  const defaultRoute = useMemo(() => {
    if (!session) return '/login';
    if (session.is_platform_admin) return '/platform';
    if (canChooseWorkspaceMode && workspaceMode === 'employee') return '/dashboard/me';
    return adminLandingRoute;
  }, [session, canChooseWorkspaceMode, workspaceMode, adminLandingRoute]);

  const value = useMemo<AuthContextValue>(
    () => ({
      isLoading,
      isAuthenticated: Boolean(session),
      session,
      login,
      logout,
      refresh: bootstrap,
      hasPermission,
      moduleByKey,
      defaultRoute,
      adminLandingRoute,
      canChooseWorkspaceMode,
      workspaceMode,
      setWorkspaceMode,
      hasManagerScope,
    }),
    [
      isLoading,
      session,
      login,
      logout,
      bootstrap,
      hasPermission,
      moduleByKey,
      defaultRoute,
      adminLandingRoute,
      canChooseWorkspaceMode,
      workspaceMode,
      setWorkspaceMode,
      hasManagerScope,
    ],
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
