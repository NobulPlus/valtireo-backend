/** Use the configured API/proxy rather than the server's advertised host. */
export function profilePhotoEndpoint(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value, 'https://relative.invalid');
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    const match = url.pathname.match(/\/api(\/employees\/\d+\/photo)$/);
    return match ? `${match[1]}${url.search}` : null;
  } catch {
    return null;
  }
}
