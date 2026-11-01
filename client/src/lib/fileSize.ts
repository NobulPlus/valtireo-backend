/**
 * Matches each backend FormRequest's own `max:` rule (in KB) — see
 * StoreLeaveRequestRequest/StoreTicketRequest — so an oversized pick is
 * rejected immediately instead of uploading the whole file first and only
 * then learning it's too large. Mirrors the mobile app's own
 * mobile/src/lib/uploadFile.ts and Connect's existing inline 10MB check.
 */
export const MAX_UPLOAD_BYTES = {
  leaveEvidence: 5 * 1024 * 1024,
  leaveHandoverDocument: 10 * 1024 * 1024,
  ticketAttachment: 5 * 1024 * 1024,
} as const;

export function isFileTooLarge(file: Pick<File, 'size'>, maxBytes: number): boolean {
  return file.size > maxBytes;
}

export function formatMaxSize(maxBytes: number): string {
  return `${Math.round(maxBytes / (1024 * 1024))}MB`;
}
