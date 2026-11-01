/** Convert picker assets to the URI part expected by React Native FormData. */
export function uploadFile(asset: { uri: string; name?: string | null; fileName?: string | null; mimeType?: string | null }) {
  return {
    uri: asset.uri,
    name: asset.name ?? asset.fileName ?? asset.uri.split('/').pop() ?? 'attachment',
    type: asset.mimeType ?? 'application/octet-stream',
  };
}

/**
 * Matches each backend FormRequest's own `max:` rule (in KB) — see
 * SubmitEmployeeDocumentRequest/StoreTicketRequest/AddTicketCommentRequest/
 * ResubmitTicketRequest/StoreLeaveRequestRequest — so an oversized pick is
 * rejected immediately instead of uploading the whole file first and only
 * then learning it's too large (over a slow connection, that wait is wasted).
 */
export const MAX_UPLOAD_BYTES = {
  document: 10 * 1024 * 1024,
  ticketAttachment: 5 * 1024 * 1024,
  leaveEvidence: 5 * 1024 * 1024,
  leaveHandoverDocument: 10 * 1024 * 1024,
  // ConnectChatController's inline validate() call, not a dedicated FormRequest.
  connectAttachment: 10 * 1024 * 1024,
} as const;

/** Picker assets report their size in bytes when known; absent/unknown is never treated as oversized. */
export function isFileTooLarge(asset: { size?: number | null }, maxBytes: number): boolean {
  return typeof asset.size === 'number' && asset.size > maxBytes;
}

export function formatMaxSize(maxBytes: number): string {
  return `${Math.round(maxBytes / (1024 * 1024))}MB`;
}
