import { apiClient } from '@/lib/apiClient';

/**
 * Document view/download endpoints require the bearer token, which a plain
 * `<a href>` navigation never carries (browsers don't attach custom headers
 * to link clicks) — every such link 401s with "Unauthenticated" regardless
 * of whether the viewer is actually logged in. Fetch through the shared
 * axios client instead (it attaches Authorization) and hand the browser a
 * local blob URL, matching the pattern already used for CSV exports.
 */

export async function openDocumentInNewTab(documentId: number): Promise<void> {
  const response = await apiClient.get(`/documents/${documentId}/view`, { responseType: 'blob' });
  const contentType = response.headers['content-type'];
  const blobUrl = window.URL.createObjectURL(new Blob([response.data], { type: typeof contentType === 'string' ? contentType : undefined }));
  window.open(blobUrl, '_blank');
}

export async function downloadDocumentFile(documentId: number, fileName: string): Promise<void> {
  const response = await apiClient.get(`/documents/${documentId}/download`, { responseType: 'blob' });
  const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(blobUrl);
}
