/** Local Laravel storage URLs use APP_URL, which may be loopback on the server. */
export function resolveAssetUrl(value: string | null | undefined, apiBaseUrl: string): string | null {
  if (!value) return null;
  if (/^(file|content|data):/i.test(value)) return value;
  try {
    const base = new URL(apiBaseUrl);
    const asset = new URL(value, `${base.origin}/`);
    if (!['http:', 'https:'].includes(asset.protocol)) return null;
    if (/^\/connect\/people\/\d+\/photo$/.test(asset.pathname)) return `${apiBaseUrl.replace(/\/$/, '')}${asset.pathname}${asset.search}`;
    // Private photo URLs must follow the same reachable API as login, even
    // when APP_URL still points at localhost or a previous development host.
    if (/\/api\/employees\/\d+\/photo$/.test(asset.pathname)) {
      const endpoint = asset.pathname.slice(asset.pathname.lastIndexOf('/employees/'));
      return `${apiBaseUrl.replace(/\/$/, '')}${endpoint}${asset.search}`;
    }
    const isLoopback = ['localhost', '127.0.0.1', '[::1]'].includes(asset.hostname);
    if (isLoopback && asset.pathname.startsWith('/storage/')) {
      return `${base.origin}${asset.pathname}${asset.search}${asset.hash}`;
    }
    return asset.href;
  } catch {
    return null;
  }
}

export function avatarSource(value: string | null | undefined, apiBaseUrl: string, token: string | null) {
  const uri = resolveAssetUrl(value, apiBaseUrl);
  if (!uri) return null;
  // Never send session credentials with local previews or third-party assets.
  const privatePhoto = (uri.startsWith(`${apiBaseUrl.replace(/\/$/, '')}/employees/`) || uri.startsWith(`${apiBaseUrl.replace(/\/$/, '')}/connect/people/`)) && /\/photo(?:\?|$)/.test(uri);
  return privatePhoto && token ? { uri, headers: { Authorization: `Bearer ${token}` } } : { uri };
}
