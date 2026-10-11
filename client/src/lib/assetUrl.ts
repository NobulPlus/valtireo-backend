/**
 * The backend builds photo/logo URLs from its own APP_URL (e.g.
 * http://127.0.0.1:8000), which in local dev is frequently NOT reachable
 * directly from the browser even though it's reachable from Vite's own dev
 * server process (e.g. Herd/WSL-style setups where the browser and the PHP
 * process sit in different network contexts) — the exact same reason /api
 * calls go through Vite's proxy instead of hitting the backend directly.
 *
 * In production VITE_API_BASE_URL is always set and the backend's absolute
 * URL is genuinely cross-origin and correct, so this only rewrites in local
 * dev: strip a /storage/* URL down to a same-origin relative path so it
 * rides through vite.config.ts's own /storage proxy instead.
 */
export function assetUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (import.meta.env.VITE_API_BASE_URL) return url;

  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.pathname.startsWith('/storage/')) {
      return parsedUrl.pathname + parsedUrl.search;
    }
  } catch {
    return url;
  }

  return url;
}
