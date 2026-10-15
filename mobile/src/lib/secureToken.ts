import * as SecureStore from 'expo-secure-store';
import { notifySessionChange } from './sessionEvents';

const TOKEN_KEY = 'valtireo.auth_token';
const BIOMETRIC_KEY = 'valtireo.biometric_credential_v2';
const BIOMETRIC_IDENTITY_KEY = 'valtireo.biometric_identity_v2';
const BIOMETRIC_OPTIONS = { requireAuthentication: true, authenticationPrompt: 'Unlock your Valtireo sign-in', keychainService: 'valtireo.biometric.v2' };

export interface BiometricCredential {
  email: string;
  password: string;
  name: string;
}
export type BiometricIdentity = Pick<BiometricCredential, 'email' | 'name'>;

/** Read only the display identity at startup, never the saved password. */
export async function loadBiometricIdentity(): Promise<BiometricIdentity | null> {
  const raw = await SecureStore.getItemAsync(BIOMETRIC_IDENTITY_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed.email === 'string' && typeof parsed.name === 'string' ? { email: parsed.email, name: parsed.name } : null;
  } catch { return null; }
}

/**
 * A separate, deliberately logout-surviving credential — "sign out" ends the
 * active session (clears TOKEN_KEY) but a device owner who enrolled Face ID
 * / fingerprint sign-in should still be able to get back in without retyping
 * their password next time the app opens. Stores the password rather than a
 * session token (there's no refresh-token endpoint on the backend), so a
 * biometric sign-in is really "Face ID unlocks the saved password, then logs
 * in normally" — the same pattern browsers and password managers use for
 * biometric-gated autofill. Cleared only by explicit opt-out or when the
 * server rejects the saved credentials (password changed elsewhere).
 */
export async function loadBiometricCredential(): Promise<BiometricCredential | null> {
  const raw = await SecureStore.getItemAsync(BIOMETRIC_KEY, BIOMETRIC_OPTIONS);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as BiometricCredential;
  } catch {
    return null;
  }
}

export async function setBiometricCredential(credential: BiometricCredential | null): Promise<void> {
  if (credential) {
    if (!SecureStore.canUseBiometricAuthentication()) throw new Error('Secure biometric storage is unavailable. Use password sign-in; biometric enrollment may require a development build.');
    await SecureStore.setItemAsync(BIOMETRIC_KEY, JSON.stringify(credential), BIOMETRIC_OPTIONS);
    await SecureStore.setItemAsync(BIOMETRIC_IDENTITY_KEY, JSON.stringify({ email: credential.email, name: credential.name }));
    await SecureStore.deleteItemAsync('valtireo.biometric_credential');
  } else {
    await SecureStore.deleteItemAsync(BIOMETRIC_KEY, BIOMETRIC_OPTIONS);
    await SecureStore.deleteItemAsync(BIOMETRIC_IDENTITY_KEY);
    await SecureStore.deleteItemAsync('valtireo.biometric_credential');
  }
}

/**
 * expo-secure-store is async-only, but the axios request interceptor needs a
 * synchronous read on every request. We keep an in-memory mirror, populated
 * once at startup by loadStoredToken() (see App.tsx), and kept in sync by
 * every write going through setStoredToken() below.
 */
let cachedToken: string | null = null;
let loaded = false;
/** Serializes SecureStore writes in call order — without this, a logout's delete and a fast-following login's set can resolve out of order and leave storage empty after a successful sign-in. */
let writeQueue: Promise<void> = Promise.resolve();
let revision = 0;

/** Call once at app startup, before rendering anything that might call the API. */
export async function loadStoredToken(): Promise<string | null> {
  if (!loaded) {
    const started = revision;
    const stored = await SecureStore.getItemAsync(TOKEN_KEY);
    if (started === revision) {
      cachedToken = stored;
      loaded = true;
    }
  }
  return cachedToken;
}

/** Synchronous accessor for the axios interceptor. Returns null until loadStoredToken() resolves. */
export function getStoredToken(): string | null {
  return cachedToken;
}

export async function setStoredToken(token: string | null): Promise<void> {
  const previous = cachedToken;
  const currentRevision = ++revision;
  cachedToken = token;
  loaded = true;
  // Publish the logical transition immediately, not after delayed disk I/O.
  if (previous !== token) notifySessionChange();

  const run = (): Promise<void> => (token ? SecureStore.setItemAsync(TOKEN_KEY, token) : SecureStore.deleteItemAsync(TOKEN_KEY));
  const settled = writeQueue.then(run, run);
  writeQueue = settled.catch(() => {});
  try {
    await settled;
  } catch (error) {
    if (revision === currentRevision && cachedToken !== null) {
      cachedToken = null;
      notifySessionChange();
    }
    throw error;
  }
}
