import { cn } from '@/lib/cn';

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'pending' | 'draft';

export const toneClasses: Record<Tone, string> = {
  success: 'bg-success-bg text-success',
  warning: 'bg-warning-bg text-warning',
  danger: 'bg-danger-bg text-danger',
  info: 'bg-info-bg text-info',
  pending: 'bg-pending-bg text-pending',
  draft: 'bg-draft-bg text-draft',
};

/**
 * Central status -> tone mapping. Every module (employee, document,
 * approval, leave, attendance, notification, profile) reuses this instead
 * of inventing its own color language, per the handoff guide's "Statuses"
 * data pattern.
 */
const STATUS_TONE: Record<string, Tone> = {
  // Employee
  active: 'success',
  onboarding: 'pending',
  invited: 'info',
  draft: 'draft',
  suspended: 'warning',
  exited: 'danger',
  // Employee confirmation status
  probation: 'warning',
  confirmed: 'success',
  not_applicable: 'draft',
  // Profile completion
  pending: 'pending',
  submitted: 'info',
  approved: 'success',
  changes_requested: 'warning',
  // Service desk ticket lifecycle
  in_progress: 'info',
  on_hold: 'warning',
  resolved: 'success',
  closed: 'draft',
  // Documents / approvals / leave / attendance
  missing: 'danger',
  expired: 'danger',
  expiring_soon: 'warning',
  pending_acknowledgment: 'warning',
  awaiting_signature: 'warning',
  superseded: 'draft',
  rejected: 'danger',
  cancelled: 'draft',
  present: 'success',
  late: 'warning',
  absent: 'danger',
  half_day: 'warning',
  corrected: 'info',
  // Notifications
  unread: 'info',
  read: 'draft',
  // Audit events
  created: 'success',
  updated: 'info',
  deleted: 'danger',
  restored: 'success',
};

function toneFor(status: string | null | undefined): Tone {
  return status ? STATUS_TONE[status] ?? 'draft' : 'draft';
}

function label(status: string | null | undefined): string {
  if (!status) return 'Unknown';

  return status
    .split(/[_-]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function StatusBadge({ status, className }: { status?: string | null; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize',
        toneClasses[toneFor(status)],
        className,
      )}
    >
      {label(status)}
    </span>
  );
}
