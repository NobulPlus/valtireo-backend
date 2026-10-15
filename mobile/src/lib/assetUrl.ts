/** Local Laravel storage URLs use APP_URL, which may be loopback on the server. */
export function resolveAssetUrl(value: string | null | undefined, apiBaseUrl: string): string | null {
  if (!value) return null;
  if (/^(file|content|data):/i.test(value)) return value;
  try {
    const base = new URL(apiBaseUrl);
    const asset = new URL(value, `${base.origin}/`);
    if (!['http:', 'https:'].includes(asset.protocol)) return null;
    const isLoopback = ['localhost', '127.0.0.1', '[::1]'].includes(asset.hostname);
    if (isLoopback && asset.pathname.startsWith('/storage/')) {
      return `${base.origin}${asset.pathname}${asset.search}${asset.hash}`;
    }
    return asset.href;
  } catch {
    return null;
  }
}
