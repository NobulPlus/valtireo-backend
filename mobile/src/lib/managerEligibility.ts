/**
 * The single source of truth for whether the manager Home section renders — see
 * docs/design-system/11-home-information-architecture.md's Manager IA and the explicit
 * instruction this encodes: eligibility is `has_manager_scope === true` on the current
 * session, full stop. No designation, job title, department, or `service_desk.view`
 * check substitutes for it, and an HR administrator is not automatically eligible
 * (server/app/Services/DashboardService.php:772-777 — `hasManagerScope()` requires both
 * an employee record AND `employees.view_team`, a different permission from any
 * HR/admin or service-desk-agent role).
 *
 * Kept as its own pure function (rather than inlined at each call site) so the rule has
 * exactly one definition and is directly unit-testable without rendering a screen.
 */
export interface ManagerEligibilitySession {
  has_manager_scope: boolean;
}

export function isEligibleForManagerHome(session: ManagerEligibilitySession | null | undefined): boolean {
  // A missing/not-yet-loaded session is never treated as eligible — only an explicit
  // `true` opts in, never a default.
  return session?.has_manager_scope === true;
}
