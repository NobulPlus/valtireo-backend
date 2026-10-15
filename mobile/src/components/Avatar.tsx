import { useState } from 'react';
import { Image, Text, View } from 'react-native';
import { apiClient } from '../lib/apiClient';
import { resolveAssetUrl } from '../lib/assetUrl';
import { getStoredToken } from '../lib/secureToken';
import { useTheme } from '../theme';

export function Avatar({ uri, name, size = 44 }: { uri?: string | null; name: string; size?: number }) {
  const url = resolveAssetUrl(uri, apiClient.defaults.baseURL ?? '');
  return <AvatarImage key={url ?? 'initials'} url={url} name={name} size={size} />;
}

function AvatarImage({ url, name, size }: { url: string | null; name: string; size: number }) {
  const { colors } = useTheme();
  const [failed, setFailed] = useState(false);
  const shape = { width: size, height: size, borderRadius: size / 2 };
  if (url && !failed) {
    // The photo is served by an authenticated endpoint (not a public storage
    // URL) — unlike a web <img>, RN's Image can attach the bearer token itself.
    const token = getStoredToken();
    const source = token ? { uri: url, headers: { Authorization: `Bearer ${token}` } } : { uri: url };
    return <Image source={source} accessibilityLabel={`${name}'s profile picture`} style={shape} resizeMode="cover" onError={() => setFailed(true)} />;
  }
  return <View accessibilityLabel={`${name}'s initials`} style={[shape, { backgroundColor: colors.pine, alignItems: 'center', justifyContent: 'center' }]}>
    <Text style={{ color: colors.white, fontSize: size / 3, fontWeight: '700' }}>{(name.trim().charAt(0) || '?').toUpperCase()}</Text>
  </View>;
}
