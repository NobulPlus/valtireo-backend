/** Convert picker assets to the URI part expected by React Native FormData. */
export function uploadFile(asset: { uri: string; name?: string | null; fileName?: string | null; mimeType?: string | null }) {
  return {
    uri: asset.uri,
    name: asset.name ?? asset.fileName ?? asset.uri.split('/').pop() ?? 'attachment',
    type: asset.mimeType ?? 'application/octet-stream',
  };
}
