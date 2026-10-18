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

/**
 * True exactly when a session transition took manager scope away — the
 * trigger for purging any cached manager-dashboard data (AuthContext.tsx's
 * bootstrap(), on every `/auth/me` refresh — the only path, besides a full
 * login/logout, that can change `has_manager_scope` without already going
 * through queryClient.clear()). Granting scope, no scope on either side, or
 * no prior session at all are all "no" — there is nothing stale to purge.
 */
export function managerScopeWasRevoked(
  previous: ManagerEligibilitySession | null | undefined,
  next: ManagerEligibilitySession | null | undefined,
): boolean {
  return isEligibleForManagerHome(previous) && !isEligibleForManagerHome(next);
}

/**
 * Whether a manager-dashboard refetch should fire after a session refresh
 * resolves (or fails to resolve) — see HomeScreen.tsx's pull-to-refresh.
 * `freshSession` is the just-resolved, authoritative answer from that same
 * refresh; `undefined` means it couldn't resolve anything new (network/
 * server error, or superseded by a newer transition), in which case the
 * caller's previously-known eligibility is the only thing left to go on.
 *
 * Deliberately evaluated from the FRESH result rather than in parallel with
 * it — racing a manager-dashboard refetch against the session refresh let a
 * just-revoked session's stale, pre-refresh `hasManagerScope` still trigger
 * one more (unauthorized, but still unnecessary) request.
 */
export function shouldRefetchManagerDashboard(
  freshSession: ManagerEligibilitySession | null | undefined,
  fallbackEligibility: boolean,
): boolean {
  return freshSession === undefined ? fallbackEligibility : isEligibleForManagerHome(freshSession);
}
