import axios, { AxiosError, type AxiosRequestConfig } from 'axios';
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
  if (token) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

apiClient.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

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

export class ApiError extends Error {
  status: number;
  errors: Record<string, string[]> | null;

  constructor(message: string, status: number, errors: Record<string, string[]> | null = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
  }

  /** First validation message for a given field, if any. */
  fieldError(field: string): string | undefined {
    return this.errors?.[field]?.[0];
  }
}

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ValidationErrorResponse | { message?: string }>) => {
    const status = error.response?.status ?? 0;
    const data = error.response?.data;
    const message =
      (data && 'message' in data && data.message) ||
      error.message ||
      'Something went wrong. Please try again.';
    const errors = data && 'errors' in data ? (data as ValidationErrorResponse).errors : null;

    if (status === 401) {
      setStoredToken(null);
      unauthorizedListeners.forEach((listener) => listener());
    }

    if (status === 403 && message.toLowerCase().includes('organization has been suspended')) {
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
