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

/** White text on a dark ink base — matches --color-strong's rgb() so it blends with the rest of the token system when a light custom color forces the dark variant. */
const LIGHT_FG = '255 255 255';
const DARK_FG = '16 24 40';

/**
 * WCAG relative luminance: picks readable foreground text for an
 * organization's own custom brand color, which can be anything an admin
 * types in — including something light enough that hardcoded white text
 * would disappear on it (e.g. a pale sidebar or button color).
 */
function contrastingForeground(hex: string): string {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const linear = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const luminance = 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  return luminance > 0.5 ? DARK_FG : LIGHT_FG;
}

export function WorkspaceThemeBridge({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const theme = session?.workspace?.theme;

  useEffect(() => {
    const root = document.documentElement;
    const sidebarColor = safeHex(theme?.sidebar_color, DEFAULT_THEME.sidebar);
    const buttonColor = safeHex(theme?.button_color, DEFAULT_THEME.button);
    const primaryColor = safeHex(theme?.primary_color, DEFAULT_THEME.primary);

    root.style.setProperty('--workspace-primary', primaryColor);
    root.style.setProperty('--workspace-primary-fg', contrastingForeground(primaryColor));
    root.style.setProperty('--workspace-accent', safeHex(theme?.accent_color, DEFAULT_THEME.accent));
    root.style.setProperty('--workspace-sidebar', sidebarColor);
    root.style.setProperty('--workspace-sidebar-fg', contrastingForeground(sidebarColor));
    root.style.setProperty('--workspace-button', buttonColor);
    root.style.setProperty('--workspace-button-fg', contrastingForeground(buttonColor));
    root.style.setProperty('--workspace-font', theme?.font_family || DEFAULT_THEME.font);
  }, [theme]);

  return <>{children}</>;
}
