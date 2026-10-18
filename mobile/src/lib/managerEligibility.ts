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
 * resolves — see HomeScreen.tsx's pull-to-refresh. `freshSession` is the
 * just-resolved result of that same refresh, which lands in one of three
 * buckets:
 *
 *  - A real session payload — refresh succeeded, and `has_manager_scope` on
 *    it is the authoritative, current answer (true: scope retained or newly
 *    granted; false: scope revoked, or was never there).
 *  - `null` — the session was explicitly invalidated (logout, or a token
 *    that turned out to be invalid). Definitely not eligible.
 *  - `undefined` — nothing new was confirmed: either a transient network/
 *    server failure, or this particular refresh was superseded by a newer
 *    session transition before it resolved. Both collapse to the same
 *    answer here for the same reason: current authorization could not be
 *    freshly confirmed, so this deliberately does NOT fall back to
 *    whatever eligibility was believed before the refresh ran. A failed or
 *    superseded refresh is not evidence that access is still fine — it is
 *    simply the absence of evidence either way, and re-affirming a stale
 *    "it was true last time" for a manager-only data request is exactly the
 *    kind of assumption this must not make. Failing closed here costs at
 *    most one skipped refetch (any already-cached team data stays exactly
 *    as it was, untouched); the user can pull to refresh again once the
 *    network/session recovers.
 *
 * This is why the function takes only `freshSession` — there is nothing a
 * caller-supplied fallback could safely add.
 */
export function shouldRefetchManagerDashboard(freshSession: ManagerEligibilitySession | null | undefined): boolean {
  return isEligibleForManagerHome(freshSession);
}
