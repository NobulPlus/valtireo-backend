import { useEffect, type ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';

const DEFAULT_THEME = {
  primary: '#123f3a',
  accent: '#2f8f8a',
  sidebar: '#123f3a',
  button: '#123f3a',
  font: 'Inter',
};

function safeHex(value: string | null | undefined, fallback: string): string {
  return value && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

export function WorkspaceThemeBridge({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const theme = session?.workspace?.theme;

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--workspace-primary', safeHex(theme?.primary_color, DEFAULT_THEME.primary));
    root.style.setProperty('--workspace-accent', safeHex(theme?.accent_color, DEFAULT_THEME.accent));
    root.style.setProperty('--workspace-sidebar', safeHex(theme?.sidebar_color, DEFAULT_THEME.sidebar));
    root.style.setProperty('--workspace-button', safeHex(theme?.button_color, DEFAULT_THEME.button));
    root.style.setProperty('--workspace-font', theme?.font_family || DEFAULT_THEME.font);
  }, [theme]);

  return <>{children}</>;
}
