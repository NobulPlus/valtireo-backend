import type { ManagerDashboard, ManagerDashboardScope } from '../types/api';

/**
 * Pure mapping from the real `/dashboard/manager` response
 * (server/app/Services/DashboardService.php:90-174, read directly) to what "Team at a
 * glance" actually shows — kept separate from HomeScreen.tsx so the mapping is directly
 * unit-testable (the mobile test harness can't render React components).
 *
 * Deliberately a NARROW slice of the real response: `employees.active` (not `.total`,
 * which includes exited/draft employees — not meaningfully "your team"),
 * `leave.pending_requests` and `attendance.corrections_pending` (both current-state
 * counts, safe to show without a time qualifier), and `team_health.incomplete_profiles`.
 *
 * Explicitly NOT shown: `attendance.present`/`late`/`absent` and
 * `leave.approved_requests`/`rejected_requests`/`days_*` — every one of these is an
 * ALL-TIME cumulative count (the backend methods computing them take no date range at
 * all, confirmed by reading attendanceMetricsForEmployees()/leaveMetricsForEmployees()
 * directly), so presenting e.g. "present: 340" on an "at a glance" card would read as
 * "today" or "this month" while actually meaning "ever" — exactly the kind of misleading
 * total the brief that commissioned this warned against. This is a confirmed backend
 * limitation (see docs/design-system/12-home-expansion-plan.md's Phase B delivery
 * notes), not an oversight — a date-scoped variant would need new backend work, which
 * this phase is not authorized to add.
 */
export interface ManagerTeamSummary {
  scopeLabel: string;
  teamSize: number;
  leavePending: number;
  correctionsPending: number;
  incompleteProfiles: number;
}

export function describeTeamScope(scope: Pick<ManagerDashboardScope, 'type' | 'department' | 'cluster'> | null | undefined): string {
  if (!scope) return 'Your team';
  if (scope.type === 'department' && scope.department) return `${scope.department.name} department`;
  if (scope.type === 'cluster' && scope.cluster) return `${scope.cluster.name} cluster`;
  return 'Your direct reports';
}

/**
 * Defensive about missing/optional sub-objects even though the TS type marks them
 * required — a real API response can still surprise a client, and falling back to 0
 * (never crashing, never fabricating a non-zero number) is the only safe default for a
 * read-only summary.
 */
export function selectManagerTeamSummary(dashboard: ManagerDashboard): ManagerTeamSummary {
  return {
    scopeLabel: describeTeamScope(dashboard.scope),
    teamSize: dashboard.employees?.active ?? 0,
    leavePending: dashboard.leave?.pending_requests ?? 0,
    correctionsPending: dashboard.attendance?.corrections_pending ?? 0,
    incompleteProfiles: dashboard.team_health?.incomplete_profiles ?? 0,
  };
}
