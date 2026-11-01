import { useState, useSyncExternalStore } from 'react';
import { Image, Text, View } from 'react-native';
import { apiClient } from '../lib/apiClient';
import { avatarSource } from '../lib/assetUrl';
import { onSessionChange } from '../lib/sessionEvents';
import { getStoredToken } from '../lib/secureToken';
import { useTheme } from '../theme';

interface AvatarProps {
  uri?: string | null;
  name: string;
  size?: number;
  /** Overrides the initials-fallback circle color (default: the legacy `colors.pine`) — e.g. Home passes the v2 palette's `primary` for Design System v2 screens, without this shared component needing to know about v2 itself. */
  fallbackColor?: string;
  /** Must accompany `fallbackColor` whenever that color isn't safe with white text (see docs/design-system/01-color-tokens.md §1) — the legacy default pairs `colors.pine` with `colors.white` unchanged. */
  fallbackTextColor?: string;
}

export function Avatar({ uri, name, size = 44, fallbackColor, fallbackTextColor }: AvatarProps) {
  const token = useSyncExternalStore(onSessionChange, getStoredToken, () => null);
  const source = avatarSource(uri, apiClient.defaults.baseURL ?? '', token);
  return <AvatarImage key={`${source?.uri ?? 'initials'}:${token ?? ''}`} source={source} name={name} size={size} fallbackColor={fallbackColor} fallbackTextColor={fallbackTextColor} />;
}

function AvatarImage({ source, name, size, fallbackColor, fallbackTextColor }: { source: ReturnType<typeof avatarSource>; name: string; size: number; fallbackColor?: string; fallbackTextColor?: string }) {
  const { colors } = useTheme();
  const [failed, setFailed] = useState(false);
  const shape = { width: size, height: size, borderRadius: size / 2 };
  if (source && !failed) {
    // The photo is served by an authenticated endpoint (not a public storage
    // URL) — unlike a web <img>, RN's Image can attach the bearer token itself.
    return <Image source={source} accessibilityLabel={`${name}'s profile picture`} style={shape} resizeMode="cover" onError={() => setFailed(true)} />;
  }
  return <View accessibilityLabel={`${name}'s initials`} style={[shape, { backgroundColor: fallbackColor ?? colors.pine, alignItems: 'center', justifyContent: 'center' }]}>
    <Text style={{ color: fallbackTextColor ?? colors.white, fontSize: size / 3, fontWeight: '700' }}>{(name.trim().charAt(0) || '?').toUpperCase()}</Text>
  </View>;
}
