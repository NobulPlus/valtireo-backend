import type { SelectMenuOption } from '@/components/ui/SelectMenu';
import type { Employee } from '@/types/api';

export const EMPLOYEE_STATUS_OPTIONS = [
  'draft',
  'invited',
  'onboarding',
  'active',
  'probation',
  'confirmed',
  'suspended',
  'exited',
];

/** Once an employee enters this lifecycle, EmployeeLifecycleService (backend) blocks moving them back to draft/invited/onboarding — mirrored here so the picker never even offers an invalid move. */
export const ACTIVE_LIFECYCLE_STATUSES = ['active', 'probation', 'confirmed', 'suspended', 'exited'];

export function statusLabel(value: string | null | undefined): string {
  if (!value) return '—';

  return value
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function statusOptionsFor(employee: Employee): SelectMenuOption[] {
  const currentStatus = employee.status;
  const allowed = ACTIVE_LIFECYCLE_STATUSES.includes(currentStatus) ? ACTIVE_LIFECYCLE_STATUSES : EMPLOYEE_STATUS_OPTIONS;

  return allowed.map((status) => ({
    value: status,
    label: statusLabel(status),
    description: status === 'invited' && currentStatus === 'draft' ? 'Creates and sends an employee invitation.' : undefined,
    disabled: status === currentStatus || (status === 'invited' && currentStatus === 'draft' && !employee.work_email),
  }));
}

/** Pure data check — does NOT include the employees.update permission gate, which callers combine at the call site. */
export function isReadyForOnboardingApproval(employee: Employee): boolean {
  return employee.status === 'onboarding' && ['submitted', 'approved'].includes(employee.profile?.completion_status ?? '');
}
