import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { api, ApiError, onUnauthorized, onWorkspaceSuspended } from '../lib/apiClient';
import {
  getStoredToken,
  loadBiometricCredential,
  loadBiometricIdentity,
  loadStoredToken,
  setBiometricCredential,
  setStoredToken,
  type BiometricCredential,
  type BiometricIdentity,
} from '../lib/secureToken';
import { onSessionChange } from '../lib/sessionEvents';
import { queryClient } from '../lib/queryClient';
import type { EntitledModule, LoginResponse, SessionPayload } from '../types/api';

interface AuthContextValue {
  isLoading: boolean;
  isAuthenticated: boolean;
  /** Set when a stored token exists but the startup /auth/me call failed for a non-auth reason (network/server). The token was kept, so this is a "Reconnect" state, not a logged-out one. */
  reconnectError: string | null;
  session: SessionPayload | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  moduleByKey: (key: string) => EntitledModule | undefined;
  /** The account a saved Face ID / fingerprint sign-in would log into, or null if none is enrolled on this device. */
  biometricCredential: BiometricIdentity | null;
  enableBiometricSignIn: (email: string, password: string) => Promise<void>;
  disableBiometricSignIn: () => Promise<void>;
  loginWithSavedCredential: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

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

/** Device-named token, matching the backend's confirmed mobile contract (see MobileSessionContractTest). */
function deviceName(): string {
  const model = Device.modelName ?? Platform.OS;
  return `${model} — Valtireo`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [reconnectError, setReconnectError] = useState<string | null>(null);
  const [biometricCredential, setBiometricCredentialState] = useState<BiometricIdentity | null>(null);
  const sessionGeneration = useRef(0);

  useEffect(() => {
    // Independent of token bootstrap below — this only decides whether the
    // Login screen offers a "Sign in with Face ID" shortcut, it never gates app startup.
    void loadBiometricIdentity().then(setBiometricCredentialState).catch(() => setBiometricCredentialState(null));
  }, []);

  const clearSession = useCallback(() => {
    sessionGeneration.current += 1;
    void setStoredToken(null).catch(() => setReconnectError('Could not clear secure storage. Retry sign-out before closing the app.'));
    void queryClient.cancelQueries();
    queryClient.clear();
    setSession(null);
    setReconnectError(null);
  }, []);

  const bootstrap = useCallback(async () => {
    const generation = sessionGeneration.current;
    let token: string | null;
    try {
      token = await loadStoredToken();
    } catch {
      setReconnectError('Could not read secure storage. Please retry.');
      setIsLoading(false);
      return;
    }
    if (!token) {
      setIsLoading(false);
      return;
    }

    try {
      const payload = await api.get<SessionPayload>('/auth/me');
      if (generation !== sessionGeneration.current || token !== getStoredToken()) return;
      setReconnectError(null);
      setSession(normalizeSessionPayload(payload));
    } catch (error) {
      if (generation !== sessionGeneration.current || token !== getStoredToken()) return;
      if (error instanceof ApiError && error.status !== 401) {
        // Network/server issue: keep the token, let the user retry rather than silently signing them out.
        setReconnectError(error.message || 'Could not reach the server. Check your connection and try again.');
      } else {
        clearSession();
      }
    } finally {
      setIsLoading(false);
    }
  }, [clearSession]);

  useEffect(() => {
    // Bootstrap awaits secure storage and HTTP before updating session state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => onUnauthorized(clearSession), [clearSession]);
  useEffect(() => onWorkspaceSuspended(clearSession), [clearSession]);

  useEffect(() => onSessionChange(() => {
    sessionGeneration.current += 1;
    setSession(null);
  }), []);

  const login = useCallback(async (email: string, password: string) => {
    clearSession();
    const generation = sessionGeneration.current;
    const payload = await api.post<LoginResponse>('/auth/login', {
      email,
      password,
      device_name: deviceName(),
    });
    if (generation !== sessionGeneration.current) throw new ApiError('Sign-in was cancelled. Please retry.', 401);
    void queryClient.cancelQueries();
    queryClient.clear();
    const saving = setStoredToken(payload.token);
    const savingGeneration = sessionGeneration.current;
    await saving;
    if (savingGeneration !== sessionGeneration.current || getStoredToken() !== payload.token) throw new ApiError('Sign-in was cancelled. Please retry.', 401);
    setSession(normalizeSessionPayload(payload));
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

  const enableBiometricSignIn = useCallback(async (email: string, password: string) => {
    const credential: BiometricCredential = { email, password, name: session?.user.name ?? email };
    await setBiometricCredential(credential);
    setBiometricCredentialState({ email: credential.email, name: credential.name });
  }, [session]);

  const disableBiometricSignIn = useCallback(async () => {
    await setBiometricCredential(null);
    setBiometricCredentialState(null);
  }, []);

  const loginWithSavedCredential = useCallback(async () => {
    const credential = await loadBiometricCredential();
    if (!credential) throw new ApiError('No saved sign-in found on this device.', 401);
    try {
      await login(credential.email, credential.password);
    } catch (err) {
      // The saved password no longer works (changed elsewhere, account
      // disabled, etc.) — drop it rather than keep offering a dead shortcut.
      if (err instanceof ApiError && err.status !== 0 && err.status < 500) {
        await setBiometricCredential(null);
        setBiometricCredentialState(null);
      }
      throw err;
    }
  }, [login]);

  const hasPermission = useCallback(
    (permission: string) => session?.permissions?.includes(permission) ?? false,
    [session],
  );

  const moduleByKey = useCallback(
    (key: string) => session?.modules?.find((module) => module.key === key),
    [session],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      isLoading,
      isAuthenticated: Boolean(session),
      reconnectError,
      session,
      login,
      logout,
      refresh: bootstrap,
      hasPermission,
      moduleByKey,
      biometricCredential,
      enableBiometricSignIn,
      disableBiometricSignIn,
      loginWithSavedCredential,
    }),
    [isLoading, session, reconnectError, login, logout, bootstrap, hasPermission, moduleByKey, biometricCredential, enableBiometricSignIn, disableBiometricSignIn, loginWithSavedCredential],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
