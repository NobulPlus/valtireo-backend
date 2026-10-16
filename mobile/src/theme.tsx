import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export interface ThemeColors {
  pine: string;
  pineDark: string;
  pineLight: string;
  ink: string;
  muted: string;
  paper: string;
  line: string;
  white: string;
  /** A neutral tint for icon chips and quiet fills — a shade between `white` (card surface) and `paper` (page), never a semantic color. */
  chip: string;
  lime: string;
  limeDeep: string;
  danger: string;
  warning: string;
  success: string;
}

/** Matches the web app's brand palette (client's Tailwind config / the pine-green sidebar seen across every screenshot), extended with the lime accent used on the marketing site's CTA for a consistent "pop" color across web, mobile and the website. */
const lightColors: ThemeColors = {
  pine: '#123f3a',
  pineDark: '#0a2420',
  pineLight: '#1d6b4e',
  ink: '#173e38',
  muted: '#60716b',
  paper: '#f3f4ef',
  line: '#e7eae4',
  white: '#ffffff',
  chip: '#edf1ee',
  lime: '#d5f78b',
  limeDeep: '#8fc73e',
  danger: '#c0392b',
  warning: '#b7791f',
  success: '#1d6b4e',
};

/** Same brand, same semantics per token (paper = page background, white = card surface, ink = primary text, muted = secondary text) — just re-tuned for a dark ground instead of inverted wholesale. */
const darkColors: ThemeColors = {
  pine: '#2fae82',
  pineDark: '#0a2420',
  pineLight: '#3ddc9b',
  ink: '#eef5f0',
  muted: '#8aa69d',
  paper: '#0c1f1b',
  line: '#234238',
  white: '#16302b',
  chip: '#1f3b33',
  lime: '#d5f78b',
  limeDeep: '#8fc73e',
  danger: '#e5695a',
  warning: '#dba243',
  success: '#3ddc9b',
};

export interface ModuleColorPair {
  bg: string;
  icon: string;
}

/** One accent pair per feature module — a soft tint for the icon chip background, a saturated color for the icon itself. Used on the Home dashboard and the More menu so navigation reads as a map of the product, not a list of labels. */
const lightModuleColors: Record<string, ModuleColorPair> = {
  leave: { bg: '#fff1d6', icon: '#b4780f' },
  attendance: { bg: '#dfeeff', icon: '#2563a8' },
  tickets: { bg: '#ffe2db', icon: '#c0392b' },
  directory: { bg: '#efe3ff', icon: '#7c4fd1' },
  calendar: { bg: '#d9f5ea', icon: '#0f8f6e' },
  assets: { bg: '#e4e6ff', icon: '#4b4fc9' },
  documents: { bg: '#f1e7da', icon: '#8a5a2b' },
  payslips: { bg: '#e3f7da', icon: '#2f8f3e' },
  profile: { bg: '#fde3f0', icon: '#c13d82' },
  lifestyle: { bg: '#ffe9ee', icon: '#d1457a' },
};

const darkModuleColors: Record<string, ModuleColorPair> = {
  leave: { bg: '#3a2f14', icon: '#f0b955' },
  attendance: { bg: '#172c3f', icon: '#6fb3f0' },
  tickets: { bg: '#3a1f1b', icon: '#f28a76' },
  directory: { bg: '#2a2140', icon: '#b596f5' },
  calendar: { bg: '#123a2e', icon: '#4fd9ad' },
  assets: { bg: '#232350', icon: '#9aa0ff' },
  documents: { bg: '#332a1e', icon: '#d1a46e' },
  payslips: { bg: '#1c3420', icon: '#7fd98c' },
  profile: { bg: '#3a1e2d', icon: '#ed7fb8' },
  lifestyle: { bg: '#3a1f2a', icon: '#f291b2' },
};

/** Fixed regardless of light/dark preference — hero/gradient moments (Login, Home header) are a brand treatment, not a themed surface. */
export const HERO_GRADIENT = ['#123F3A', '#0E332E'] as const;
export const HERO_ACCENT = '#D7F86B';

// --- Design System v2 ("Warm & Human") — additive, Login screen only for now. ---
// See docs/design-system/01-color-tokens.md and 07-cross-platform-token-architecture.md.
// Every export above this line is untouched, so every screen other than Login keeps
// rendering exactly as it did before — this is the mobile-only subset of the
// legacy/v2 dual-palette architecture those docs describe (07 §7a).
export interface V2Colors {
  bg: string;
  surface: string;
  chip: string;
  border: string;
  ink: string;
  muted: string;
  danger: string;
  warning: string;
  primary: string;
  primaryStrong: string;
  primaryDark: string;
  accentApricot: string;
  /** Fixed dark text/icon color for use on top of `primary`/`accentApricot`/`primaryDark` fills, in both themes. */
  inkOnAccent: string;
}

export const v2Light: V2Colors = {
  bg: '#FFF9F0',
  surface: '#FFFFFF',
  chip: '#F3ECDD',
  border: '#EAE2D3',
  ink: '#071F24',
  muted: '#4F6B6E',
  danger: '#D14343',
  warning: '#C17A1F',
  primary: '#0EA5A0',
  primaryStrong: '#00585B',
  primaryDark: '#39CFC0',
  accentApricot: '#FF9B54',
  inkOnAccent: '#071F24',
};

export const v2Dark: V2Colors = {
  bg: '#071F24',
  surface: '#123237',
  chip: '#1B3F43',
  border: '#1C3A3E',
  ink: '#F5EFE4',
  muted: '#9FB8BA',
  danger: '#FF6B6B',
  warning: '#E2A33D',
  primary: '#0EA5A0',
  primaryStrong: '#00585B',
  primaryDark: '#39CFC0',
  accentApricot: '#FF9B54',
  inkOnAccent: '#071F24',
};

/**
 * The CTA gradient's dark-mode stops (`primary` → `primaryDark`) are both light/bright
 * teals — only `inkOnAccent` text is contrast-safe across the whole gradient there
 * (white on `primaryDark` is 1.93:1, a hard fail). Light mode's stops (`primaryStrong` →
 * `primary`) need white text instead, since `primaryStrong` is too dark for `inkOnAccent`
 * text to read against. See docs/design-system/01-color-tokens.md §1.
 */
export const CTA_GRADIENT = {
  light: ['#00585B', '#0EA5A0'] as const,
  dark: ['#0EA5A0', '#39CFC0'] as const,
};

/** Font-family names as registered by `useFonts()` in App.tsx via @expo-google-fonts. */
export const V2_FONTS = {
  interRegular: 'Inter_400Regular',
  interMedium: 'Inter_500Medium',
  interSemiBold: 'Inter_600SemiBold',
  interBold: 'Inter_700Bold',
  manropeBold: 'Manrope_700Bold',
  manropeExtraBold: 'Manrope_800ExtraBold',
} as const;

/** The v2 palette resolved against the current light/dark/system preference. */
export function useV2Colors(): V2Colors {
  const { scheme } = useTheme();
  return scheme === 'dark' ? v2Dark : v2Light;
}

/**
 * Module-accent map for Home (Design System v2) — same shape as the legacy
 * `ModuleColorPair` so `IconTile`/`SectionIcon`-style usage needs no structural
 * change, new values per docs/design-system/01-color-tokens.md §5. Theme-invariant
 * (same light/dark), like the legacy module-color pattern mostly already is.
 */
export const v2ModuleColors: Record<string, ModuleColorPair> = {
  leave: { bg: '#FBEBD4', icon: '#B8792B' },
  attendance: { bg: '#DCEEF7', icon: '#2E7FB0' },
  tickets: { bg: '#FBE2DC', icon: '#C1503D' },
  directory: { bg: '#EBE4F9', icon: '#7A5BC1' },
  calendar: { bg: '#DCF2E7', icon: '#2F8F6B' },
  assets: { bg: '#E2E5FB', icon: '#4A5FC9' },
  documents: { bg: '#F1E7D7', icon: '#8C6A3F' },
  payslips: { bg: '#DFF3E1', icon: '#3C9A4F' },
  profile: { bg: '#FBE1EC', icon: '#C1507E' },
  lifestyle: { bg: '#FCE5EB', icon: '#D1567A' },
  recruitment: { bg: '#FBE7D4', icon: '#C1621E' },
  performance: { bg: '#D9F2EE', icon: '#1F8A78' },
  learning: { bg: '#DEE6F5', icon: '#3A5FA0' },
  financial_admin: { bg: '#F2E9D2', icon: '#96762A' },
  ai_assistant: { bg: '#EDE4FB', icon: '#8B5FD9' },
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };

export const radius = { sm: 8, md: 12, lg: 16, xl: 22, pill: 999 };

/** A neutral shadow color works on both grounds, so this stays theme-invariant. */
export const shadow = {
  soft: { shadowColor: '#000000', shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
  tile: { shadowColor: '#000000', shadowOpacity: 0.1, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
};

function makeTypography(colors: ThemeColors) {
  return {
    display: { fontSize: 26, fontWeight: '800' as const, color: colors.ink, letterSpacing: -0.3 },
    title: { fontSize: 22, fontWeight: '700' as const, color: colors.ink },
    heading: { fontSize: 17, fontWeight: '600' as const, color: colors.ink },
    body: { fontSize: 14, color: colors.ink },
    caption: { fontSize: 12, color: colors.muted },
  };
}

export type Typography = ReturnType<typeof makeTypography>;
export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedScheme = 'light' | 'dark';

const PREFERENCE_KEY = 'valtireo.theme_preference';

interface ThemeContextValue {
  scheme: ResolvedScheme;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  colors: ThemeColors;
  moduleColors: Record<string, ModuleColorPair>;
  typography: Typography;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  useEffect(() => {
    void SecureStore.getItemAsync(PREFERENCE_KEY).then((value) => {
      if (value === 'light' || value === 'dark' || value === 'system') setPreferenceState(value);
    });
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    void SecureStore.setItemAsync(PREFERENCE_KEY, next);
  }, []);

  const scheme: ResolvedScheme = preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference;
  const colors = scheme === 'dark' ? darkColors : lightColors;
  const moduleColors = scheme === 'dark' ? darkModuleColors : lightModuleColors;
  const typography = useMemo(() => makeTypography(colors), [colors]);

  const value = useMemo<ThemeContextValue>(
    () => ({ scheme, preference, setPreference, colors, moduleColors, typography }),
    [scheme, preference, setPreference, colors, moduleColors, typography],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
}

/** Shared native-stack screenOptions so every stack's header and screen background follow the active theme, not just each screen's own content. */
export function navigatorScreenOptions(colors: ThemeColors) {
  return {
    headerTintColor: colors.pine,
    headerStyle: { backgroundColor: colors.white },
    headerTitleStyle: { color: colors.ink },
    contentStyle: { backgroundColor: colors.paper },
  };
}
