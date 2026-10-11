import axios, { AxiosError, type AxiosRequestConfig } from 'axios';
import { ApiError } from './ApiError';
export { ApiError } from './ApiError';
import { notifySessionChange } from './sessionEvents';
import type { ValidationErrorResponse } from '@/types/api';

const TOKEN_STORAGE_KEY = 'valtireo.auth_token';

/**
 * Default to the Vite dev proxy (see vite.config.ts) so the browser never
 * has to negotiate CORS with the Laravel backend. Set VITE_API_BASE_URL to
 * point somewhere else (e.g. a deployed API) when needed.
 */
const baseURL = import.meta.env.VITE_API_BASE_URL || '/api';

export const apiClient = axios.create({
  baseURL,
  headers: {
    Accept: 'application/json',
  },
});

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setStoredToken(token: string | null): void {
  const previous = getStoredToken();
  if (token) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
  if (previous !== token) notifySessionChange();
}

apiClient.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, undefined, { synchronous: true });

/** A single event bus so the auth context can react to auth failures from anywhere. */
type UnauthorizedListener = () => void;
const unauthorizedListeners = new Set<UnauthorizedListener>();
const workspaceSuspendedListeners = new Set<UnauthorizedListener>();

export function onUnauthorized(listener: UnauthorizedListener): () => void {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}

export function onWorkspaceSuspended(listener: UnauthorizedListener): () => void {
  workspaceSuspendedListeners.add(listener);
  return () => workspaceSuspendedListeners.delete(listener);
}

apiClient.interceptors.response.use(
  (response) => {
    const sentAuthorization = response.config.headers.Authorization;
    const expectedAuthorization = getStoredToken() ? 'Bearer ' + getStoredToken() : undefined;
    if (sentAuthorization !== expectedAuthorization) {
      return Promise.reject(new ApiError('The session has changed. Please retry.', 401));
    }
    return response;
  },
  (error: AxiosError<ValidationErrorResponse | { message?: string; code?: string }>) => {
    const sentAuthorization = error.config?.headers?.Authorization;
    const currentToken = getStoredToken();
    const expectedAuthorization = currentToken ? 'Bearer ' + currentToken : undefined;
    if (sentAuthorization !== expectedAuthorization) {
      return Promise.reject(new ApiError('The session has changed. Please retry.', 401));
    }
    const status = error.response?.status ?? 0;
    const data = error.response?.data;
    const message =
      (data && 'message' in data && data.message) ||
      error.message ||
      'Something went wrong. Please try again.';
    const errors = data && 'errors' in data ? (data as ValidationErrorResponse).errors : null;

    const belongsToCurrentSession = Boolean(currentToken && sentAuthorization === 'Bearer ' + currentToken);

    if (status === 401 && belongsToCurrentSession) {
      setStoredToken(null);
      unauthorizedListeners.forEach((listener) => listener());
    }

    if (status === 403 && belongsToCurrentSession && data && 'code' in data && data.code === 'organization_access_revoked') {
      setStoredToken(null);
      workspaceSuspendedListeners.forEach((listener) => listener());
    }

    return Promise.reject(new ApiError(message, status, errors ?? null));
  },
);

/** Thin typed wrappers so call sites don't repeat `.data` everywhere. */
export const api = {
  get: async <T>(url: string, config?: AxiosRequestConfig): Promise<T> =>
    (await apiClient.get<T>(url, config)).data,
  post: async <T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> =>
    (await apiClient.post<T>(url, body, config)).data,
  patch: async <T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> =>
    (await apiClient.patch<T>(url, body, config)).data,
  put: async <T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> =>
    (await apiClient.put<T>(url, body, config)).data,
  delete: async <T>(url: string, config?: AxiosRequestConfig): Promise<T> =>
    (await apiClient.delete<T>(url, config)).data,
};
