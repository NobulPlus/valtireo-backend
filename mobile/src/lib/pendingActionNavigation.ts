/**
 * Pure decision logic for Home's "Needs your attention" card — kept separate from
 * HomeScreen.tsx so it's directly unit-testable (the mobile test harness can't render
 * React components). See docs/design-system/10-home-experience-audit.md item 1 and
 * 12-home-expansion-plan.md Phase A, item 1.
 *
 * The five keys are exactly what `DashboardService::pendingActions()`
 * (server/app/Services/DashboardService.php:846-890) can return. `leave_approval`'s
 * meaning is confirmed from that source (lines 864-868): "your own leave request is
 * awaiting approval" — a status about the employee's own request, not a task where the
 * employee reviews someone else's. Only `complete_profile` is something the employee
 * can actually act on; the other four are statuses to be aware of, not tasks to
 * complete — the `tone` below exists so the UI never visually represents an
 * informational status as an urgent task.
 */

export type PendingActionTone = 'actionable' | 'informational';

export type PendingActionDestination =
  | { kind: 'profile' }
  | { kind: 'leaveTab' }
  | { kind: 'ticketsTab' }
  | { kind: 'none' };

export interface PendingActionAccess {
  /** `moduleByKey('leave')?.can_access === true` */
  leave: boolean;
  /** `moduleByKey('service_desk')?.can_access === true` */
  serviceDesk: boolean;
}

export interface PendingActionResolution {
  tone: PendingActionTone;
  destination: PendingActionDestination;
}

const TONE_BY_KEY: Record<string, PendingActionTone> = {
  complete_profile: 'actionable',
  profile_approval: 'informational',
  leave_approval: 'informational',
  leave_handover_cover: 'informational',
  ticket_pending: 'informational',
};

/**
 * Module access must be checked here, not assumed — a pending action referencing a
 * module the employee can no longer access (e.g. it was disabled after the action was
 * generated) must fail gracefully to a non-interactive row, never a broken `navigate()`
 * call into an unregistered tab.
 */
export function resolvePendingAction(key: string, access: PendingActionAccess): PendingActionResolution {
  const tone = TONE_BY_KEY[key] ?? 'informational';

  switch (key) {
    case 'complete_profile':
    case 'profile_approval':
      return { tone, destination: { kind: 'profile' } };
    case 'leave_approval':
    case 'leave_handover_cover':
      return { tone, destination: access.leave ? { kind: 'leaveTab' } : { kind: 'none' } };
    case 'ticket_pending':
      return { tone, destination: access.serviceDesk ? { kind: 'ticketsTab' } : { kind: 'none' } };
    default:
      // An unrecognized key (a future backend addition this client doesn't know about
      // yet) — fail gracefully: informational, no navigation, still shows the label.
      return { tone: 'informational', destination: { kind: 'none' } };
  }
}

/**
 * The card's heading must not claim every item in it needs the employee's intervention
 * when most of them are just statuses — "Needs your attention" is only accurate when at
 * least one item actually is. A minimal, content-driven heading swap, not a restructure:
 * the underlying data, order, and per-item destinations are all unchanged either way.
 */
export function selectPendingActionsHeading(tones: PendingActionTone[]): string {
  return tones.includes('actionable') ? 'Needs your attention' : 'Updates';
}
