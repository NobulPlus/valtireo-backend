export function assetUrl(url: string | null | undefined): string | null {
  if (!url) return null;

  const devBackend = import.meta.env.VITE_API_PROXY_TARGET as string | undefined;
  if (!devBackend) return url;

  try {
    const parsedUrl = new URL(url);
    const parsedBackend = new URL(devBackend);

    if (
      parsedUrl.pathname.startsWith('/storage/') &&
      ['127.0.0.1', 'localhost'].includes(parsedUrl.hostname) &&
      parsedUrl.port === '8000'
    ) {
      parsedUrl.protocol = parsedBackend.protocol;
      parsedUrl.hostname = parsedBackend.hostname;
      parsedUrl.port = parsedBackend.port;
      return parsedUrl.toString();
    }
  } catch {
    return url;
  }

  return url;
}
