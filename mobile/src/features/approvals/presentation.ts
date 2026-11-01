import type { Ionicons } from '@expo/vector-icons';
import type { V2Colors } from '../../theme';

/** Same module keys ApprovalRequest.module can hold (server/app/Services/ApprovalVisibility.php) mapped onto Home/More's existing v2ModuleColors tints and icons, shared by the Approvals list and detail screens instead of each inventing its own. */
export const MODULE_PRESENTATION: Record<string, { icon: keyof typeof Ionicons.glyphMap; colorKey: string }> = {
  leave: { icon: 'calendar-outline', colorKey: 'leave' },
  attendance: { icon: 'time-outline', colorKey: 'attendance' },
  employee_documents: { icon: 'document-text-outline', colorKey: 'documents' },
  service_desk: { icon: 'ticket-outline', colorKey: 'tickets' },
  payroll: { icon: 'cash-outline', colorKey: 'payslips' },
};

export function formatSnakeCase(value: string): string {
  return value.split('_').filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

/** Alpha-tinted pill, same technique as Home's compliance badges (`${color}1F` background, bold solid text) — not a flat color-only label. v2 has no dedicated "success" token, so an approved decision reads in the brand primary teal rather than inventing a green. */
export function statusTone(status: string, v2: V2Colors): { bg: string; fg: string } {
  const fg = { pending: v2.warning, approved: v2.primary, rejected: v2.danger, changes_requested: v2.warning, cancelled: v2.muted }[status] ?? v2.muted;
  return { bg: `${fg}1F`, fg };
}
