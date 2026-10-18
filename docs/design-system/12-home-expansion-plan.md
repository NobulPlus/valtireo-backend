# 12 — Home Expansion: Phases, Responsiveness/Accessibility, Regression & Security

Builds on [10](10-home-experience-audit.md) and
[11](11-home-information-architecture.md). Still a proposal — no implementation
authorized by this document.

## Prioritized implementation phases

### Phase A — Employee IA fixes (near-zero backend risk; all data already flows)

1. Make pending-action items tappable, deep-linked per `action.key`. **Revised this
   pass**: `leave_approval`'s semantic is now confirmed directly from source
   (`DashboardService.php:864-868` — "your own leave request is awaiting approval," a
   self-scoped signal) — the earlier "verify before wiring" caveat is resolved; all five
   keys' destinations (Profile ×2, Leave ×2, Tickets tab) are unambiguous and ready to wire.
2. Wire notification `action_url`/`entity_type`/`entity_id` into real navigation — build the
   web-path-to-mobile-stack mapping as an isolated, pure, unit-testable function (same
   pattern as `mobile/src/lib/biometricErrorPresentation.ts` from this session's Login
   work), not inline in `NotificationsScreen.tsx`.
3. Make the next-holiday card tappable → Calendar screen.
4. Add the Birthdays/anniversaries/appreciation card, gated by the existing lifestyle
   feature flags, reusing the existing `useMilestones`/`useAppreciations` hooks unchanged.

**Regression checkpoint after Phase A**: every existing Home card still renders
identically for an account with no manager scope and no lifestyle features enabled (both
flags off) — the new interactive behaviors (deep-links) must not alter any card's
appearance when not tapped.

### Phase B — Manager IA: Team at a glance only

**Revised this pass**: Approvals is removed from this phase entirely (see Phase C below) —
Phase B now ships only the informational team-summary card, per
[11](11-home-information-architecture.md)'s Manager IA correction.

5. Build `useManagerDashboard` on mobile, calling the existing `GET /dashboard/manager`
   endpoint (same contract the web app already consumes via
   `client/src/features/dashboard/api.ts:39-44`) — no backend change.
6. Add the "Team at a glance" card, gated strictly on `has_manager_scope`, positioned
   **after** the Pending Actions card (per [11](11-home-information-architecture.md)'s
   corrected ordering — never above a manager's own urgent personal items), no department
   picker in this version.

**Regression checkpoint after Phase B**: an account WITHOUT `has_manager_scope` sees
*zero* layout difference from Phase A's end state — no reserved blank space, no flash of
a loading card that then disappears. An account WITH `has_manager_scope` but zero direct
reports sees the card simply not render (same "conditional card" pattern the codebase
already uses everywhere else), not a zeroed-out card. An account WITH `has_manager_scope`
and a pending action of their own sees that pending-actions card above the new Team at a
glance card, not below it.

### Phase C — Manager approvals (actionable; gated on verification, not yet authorized)

**New phase, split out of what was previously bundled into Phase B.** Approvals is an
*actionable* feature (per [10](10-home-experience-audit.md)'s taxonomy) that would let a
manager take a real, consequential action (approve/reject/request changes) from mobile for
the first time — this warrants its own verification step before any implementation, not
inclusion alongside Phase B's read-only card. Not authorized by this document; listed so it
is tracked as the clear next step after Phase B, not lost.

7. **Verify first, before writing any mobile code**: exercise
   `GET /approvals?status=pending` from a real manager account against a real workflow
   configuration and confirm (a) `ApprovalRequestService::ensureActorCanApproveStep()`'s
   `direct_manager`/`department_head` branches behave as read for the organization's actual
   workflow setups, not just in the abstract; (b) the response shape/pagination is usable
   for a lightweight mobile teaser without over-fetching (see the security test plan's
   data-minimization note below); (c) `POST /approvals/{id}/actions` behaves correctly when
   called from a context that isn't the web admin UI it was originally built for.
8. Only once 7 passes: build the approvals teaser/count and, separately, any in-app
   approve/reject action — these may warrant being split into their own sub-phases once the
   verification above is done, rather than assumed to ship together.

### Phase D — Backend work, explicitly out of this proposal's authorization

These require new backend development and are **not** authorized by this document — listed
here only so they're tracked as known follow-ups if the business decides to pursue them
later, each needing its own separate approval:

9. Manager-scoped ticket visibility, if a genuine "my team's tickets" (not
   "my agent queue") concept is wanted.
10. Manager-scoped payroll/assets summaries (confirmed absent today, per
    [10](10-home-experience-audit.md) item 9).
11. A dedicated lightweight "pending approvals count" endpoint, to reduce Phase C's
    reliance on a full list-fetch for a teaser — worth sequencing ahead of Phase C's mobile
    work if backend capacity allows, though not a blocking dependency.
12. A combined lifestyle-summary endpoint (optional performance nice-to-have; Phase A's
    two-call client-side aggregation is acceptable at current scale per the backend
    research).

## Mobile responsiveness and accessibility requirements

Extends [06-accessibility-and-responsive-requirements.md](06-accessibility-and-responsive-requirements.md)
rather than duplicating it — the following are additions specific to this expansion:

- **Conditional-card layout safety**: the "hidden tab button still reserves its flex slot"
  lesson already documented in this codebase
  (`mobile/src/navigation/MainTabs.tsx`'s own comment about registered-vs-hidden tabs) is
  the same risk class as a conditionally-rendered Home card — the Team-at-a-glance and
  Lifestyle cards must be **not rendered at all** when their gate is false, not rendered-
  and-hidden, or non-managers will see a dead gap where the card would have been.
- **New cards reuse existing tokens only**: `surface`/`border`/`chip` for the card
  shell, `v2ModuleColors` where a module-colored icon applies, `accentApricot` reserved for
  at most one element per screen (already spent on the next-holiday card — the Lifestyle
  card should use a neutral/teal treatment, not a second apricot moment, to keep "one bold
  accent" discipline intact).
- **Touch targets**: every newly-tappable element (pending-action rows, the holiday card,
  notification rows) must meet the existing 48×48 minimum already specified in
  [06](06-accessibility-and-responsive-requirements.md) §2 — a text row becoming tappable
  needs adequate vertical padding, not just a bare `onPress` on tight text.
- **Dynamic Type / larger system font settings**: the Team-at-a-glance card's
  present/absent/late numbers should follow the same "big number, small label" pattern
  already used for the stat cards and leave-balance chips (this session's Home polish
  pass) — verify it doesn't overflow at a larger system font size the same way the header
  greeting was stress-tested down to a 320px viewport.
- **Employee photos in the Lifestyle card** (if birthday/anniversary entries ever show a
  colleague's photo): must use the same authenticated-photo endpoint pattern already
  established for passport photos this session (`/api/employees/{employee}/photo`, not a
  public URL) — this is a real security-consistency requirement, not a style preference,
  given the precedent this exact codebase already set.

## Regression and security test plan

**Regression**: this codebase's mobile test harness cannot render React components (an
established limitation this session, see `tests/contracts.cjs`'s pattern) — so, following
the precedent set for `classifyBiometricFailure`, every piece of new *decision logic*
should be extracted into a pure, directly-testable function and unit-tested the same way:

- The pending-action `action.key` → navigation-target mapping.
- The notification `action_url`/`entity_type` → mobile stack/screen/params mapping.
- Any client-side aggregation logic for the Lifestyle card (e.g., "pick the nearest
  upcoming milestone").

Manual/on-device regression (this session's established limitation — no device/emulator
access in this environment) should cover: Home renders identically for a non-manager
account before and after Phase B ships; a manager account's new card appears without
disturbing any other card's position; every new deep link lands on the correct real
screen, not a 404/crash.

**Security-specific test plan** (new, because Phase B introduces manager-scoped data onto
a screen every employee sees the chrome of):

1. **Gate at the fetch, not just the render.** `useManagerDashboard` must only be called
   when `has_manager_scope === true` — never fetch-then-hide. A non-manager account must
   generate zero network requests to `/dashboard/manager` (verify via request inspection
   during testing, not just visual confirmation that the card doesn't show).
2. **Freshness of `has_manager_scope`.** This is a point-in-time value from the last
   session payload — if a manager's team is reassigned or their `employees.view_team`
   permission is revoked, the app must re-fetch session state before continuing to show
   the card (verify this follows whatever session-refresh mechanism already exists in
   `AuthContext.tsx`, rather than trusting a value cached indefinitely from login).
3. **Scope narrowness.** Confirm mobile's `/dashboard/manager` call never passes a
   `department_id` param that would let it browse outside the caller's own default scope —
   this is a deliberate mobile-side restriction (per
   [11](11-home-information-architecture.md)), not a backend enforcement gap, so it must be
   tested as a client-side contract (the request mobile sends), not assumed from the
   backend's own permission check alone.
4. **Cross-tenant isolation.** Standard check, consistent with every other endpoint in
   this app: confirm the manager-dashboard response never includes data from outside the
   caller's own organization (this should already be true given the backend's existing
   tenancy middleware, per audit `01`'s architecture findings — this test simply confirms
   the new mobile consumer doesn't somehow bypass it, e.g. via a cached cross-account
   token).
5. **Approvals-teaser data minimization** (applies to Phase C, once authorized — not
   Phase B). The light list-fetch for the approvals count should request the minimum
   fields needed for a count/teaser, not the full `ApprovalRequest` resource with its
   nested subject/workflow detail, to avoid over-fetching sensitive request content (e.g.
   leave reason text) onto a summary card that only needs a number. This is exactly the
   kind of API-behavior question Phase C's verification step (item 7) exists to answer
   before any mobile code is written.

## What this file still does not do

- It does not authorize Phase A, B, C, or D to begin — all four remain proposals pending
  approval, with Phase C additionally gated on its own verification step before any
  mobile code is written, independent of whether Phase A/B are approved.
- It does not modify `06-accessibility-and-responsive-requirements.md` itself (this file
  extends it by reference, not by edit, to avoid two documents claiming the same content).
- It does not touch any application code, Login, Home, backend APIs, or any other mobile
  screen.
