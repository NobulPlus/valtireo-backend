import { useEffect, useState, useSyncExternalStore } from 'react';
import { apiClient, getStoredToken } from '@/lib/apiClient';
import { onSessionChange } from './sessionEvents';
import { profilePhotoEndpoint } from './profilePhotoUrl';

/**
 * Employee photos are served by an authenticated, organization-scoped
 * endpoint rather than a public storage URL, so a plain <img src> 401s —
 * browsers never attach the bearer token to an image request. Fetch through
 * the shared axios client instead (it attaches Authorization) and hand the
 * <img> a local blob URL — the same fix already applied to document
 * view/download in lib/documents.ts for the same reason.
 */
export function useAuthenticatedImage(url: string | null | undefined): string | null {
  const token = useSyncExternalStore(onSessionChange, getStoredToken, () => null);
  const endpoint = profilePhotoEndpoint(url);
  const [image, setImage] = useState<{ endpoint: string; token: string; blobUrl: string } | null>(null);

  useEffect(() => {
    if (!endpoint || !token) return;

    let cancelled = false;
    let objectUrl: string | null = null;

    apiClient
      .get(endpoint, { responseType: 'blob' })
      .then((response) => {
        if (cancelled) return;
        objectUrl = window.URL.createObjectURL(response.data as Blob);
        setImage({ endpoint, token, blobUrl: objectUrl });
      })
      .catch(() => {
        if (!cancelled) setImage(null);
      });

    return () => {
      cancelled = true;
      if (objectUrl) window.URL.revokeObjectURL(objectUrl);
    };
  }, [endpoint, token]);

  return image?.endpoint === endpoint && image?.token === token ? image.blobUrl : null;
}
