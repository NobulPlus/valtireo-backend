import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';

export type ThemePreference = 'light' | 'dark' | 'system';
type EffectiveTheme = 'light' | 'dark';

const STORAGE_KEY = 'valtireo-theme';

interface ThemeContextValue {
  /** What the user (or the org default, absent a personal choice) has selected. */
  preference: ThemePreference;
  /** What's actually rendered right now — resolves 'system' against the OS setting. */
  effective: EffectiveTheme;
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function isThemePreference(value: string | null): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

function systemPrefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/** Mirrors the inline bootstrap script in index.html — 'system' means no attribute, letting the CSS media query decide. */
function applyTheme(preference: ThemePreference): EffectiveTheme {
  const root = document.documentElement;
  if (preference === 'system') {
    root.removeAttribute('data-theme');
    return systemPrefersDark() ? 'dark' : 'light';
  }
  root.setAttribute('data-theme', preference);
  return preference;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [preference, setPreferenceState] = useState<ThemePreference>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isThemePreference(stored) ? stored : 'system';
  });
  const [effective, setEffective] = useState<EffectiveTheme>(() => applyTheme(preference));

  // Adopt the organization's default once the session loads — but only for a
  // device that has never had a personal choice made on it. A stored key
  // (even 'system', chosen explicitly) always wins over the org default.
  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY) !== null) return;
    const orgMode = session?.workspace?.theme.mode;
    if (orgMode && orgMode !== preference) {
      setPreferenceState(orgMode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.workspace?.theme.mode]);

  useEffect(() => {
    setEffective(applyTheme(preference));
  }, [preference]);

  useEffect(() => {
    if (preference !== 'system') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => setEffective(systemPrefersDark() ? 'dark' : 'light');
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, [preference]);

  function setPreference(next: ThemePreference) {
    localStorage.setItem(STORAGE_KEY, next);
    setPreferenceState(next);
  }

  const value = useMemo(() => ({ preference, effective, setPreference }), [preference, effective]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
}
