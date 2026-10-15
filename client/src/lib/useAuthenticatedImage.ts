import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/apiClient';

/**
 * Employee photos are served by an authenticated, organization-scoped
 * endpoint rather than a public storage URL, so a plain <img src> 401s —
 * browsers never attach the bearer token to an image request. Fetch through
 * the shared axios client instead (it attaches Authorization) and hand the
 * <img> a local blob URL — the same fix already applied to document
 * view/download in lib/documents.ts for the same reason.
 */
export function useAuthenticatedImage(url: string | null | undefined): string | null {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!url) {
      setBlobUrl(null);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;

    apiClient
      .get(url, { responseType: 'blob' })
      .then((response) => {
        if (cancelled) return;
        objectUrl = window.URL.createObjectURL(response.data as Blob);
        setBlobUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setBlobUrl(null);
      });

    return () => {
      cancelled = true;
      if (objectUrl) window.URL.revokeObjectURL(objectUrl);
    };
  }, [url]);

  return blobUrl;
}
