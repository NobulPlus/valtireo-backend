# 11 — Home Information Architecture: Current vs. Proposed

Builds directly on [10-home-experience-audit.md](10-home-experience-audit.md)'s
evidence. Visual treatment throughout follows the approved Concept B — Warm & Human
system already specified in [01](01-color-tokens.md)–[03](03-component-specifications.md)
and implemented for Login/Home's existing cards — every new element below reuses existing
tokens/components (`Card`-equivalent surface/border, `v2ModuleColors`, `accentApricot` for
the one reserved special moment, the established type scale). No new colors, fonts, or
component primitives are proposed.

## Current Home structure (as implemented today)

1. Header — greeting, theme toggle, directory icon (conditional on workspace setting),
   notifications bell (with unread badge), avatar.
2. Quick access card — Assets, Documents, Payslips tiles (each gated on module
   entitlement).
3. Pending actions card (conditional) — static bullet list, no deep links.
4. Stats row — leave pending, days present, doc items (always visible when data loaded).
5. My role card (conditional) — designation, manager, tenure.
6. Attendance exceptions card (conditional).
7. Document compliance card (conditional) — has one working deep link ("Go to documents").
8. Leave handover card (conditional).
9. Leave balances card (conditional).
10. Next holiday card (conditional) — no deep link.

Everything below the header is self-scoped to the signed-in employee; there is no
manager-facing content anywhere, and `has_manager_scope` (sent on every session) is never
read.

## Proposed Home structure

Additions are marked **NEW**; everything else is unchanged in content, only (per
[10](10-home-experience-audit.md)) made interactive where it previously wasn't. Ordering
revised this pass per the actionable-vs-informational taxonomy
([10](10-home-experience-audit.md)): **urgent personal, actionable content is placed ahead
of the manager's informational team summary**, not above it as an earlier draft had it.

1. Header — unchanged.
2. Quick access card — unchanged tiles, same gating, same position as today.
3. Pending actions card — same data, **now tappable per item** (deep-links to Profile for
   `complete_profile`/`profile_approval`, Leave for `leave_approval`/`leave_handover_cover`,
   Tickets tab for `ticket_pending` — all five keys' destinations are confirmed, per
   [10](10-home-experience-audit.md) item 1's corrected access-rules entry). This is
   actionable, personal, and urgent — it keeps its existing position, immediately after
   Quick Access, exactly where it is today.
4. **NEW — Team at a glance card** (conditional on `has_manager_scope`, see Manager IA
   below) — positioned **after** Pending Actions, not before Quick Access as an earlier
   draft proposed. A manager's own outstanding personal task (an incomplete profile, their
   own leave awaiting approval) is never pushed below a summary of their team's status —
   the card reads as "here's your team, once your own things are handled," not as the
   first thing competing for attention on a manager's Home.
5. Stats row — unchanged.
6. My role card — unchanged.
7. Attendance exceptions card — unchanged.
8. Document compliance card — unchanged (already has its one deep link).
9. Leave handover card — unchanged.
10. Leave balances card — unchanged.
11. **NEW — Birthdays, anniversaries & appreciation card** (conditional on the lifestyle
    feature flags) — positioned after Leave balances, same visual tier, informational not
    navigational (no required action, just a reason to open Lifestyle if interested).
12. Next holiday card — same content, **now tappable** → Calendar screen.

No card is removed, no existing card's data is reduced, and no card changes its gating
logic. Approvals is **not** in this structure — per [10](10-home-experience-audit.md)'s
revised item 10 and this file's Manager IA below, it is held out as its own, later,
separately-approved phase, not bundled into the initial Team-at-a-glance card.

## Employee Home information architecture

The employee's Home remains what it is today — a single-scroll personal dashboard, no
tabs, no sections requiring horizontal navigation — with the gaps in
[10](10-home-experience-audit.md) closed:

- **Act** (top of the interactive hierarchy): pending actions, now navigable — including on
  a manager's own Home, where this personal tier still sits ahead of their Team at a
  glance card (see Proposed Home structure above).
- **Track**: stats row, attendance, document compliance, leave balances/handover — unchanged,
  these are the "status of things I'm tracking" tier.
- **Belong** (new): the Lifestyle card is deliberately placed *after* the tracking cards,
  not competing with them for primary attention — it's a lower-urgency, higher-warmth
  addition consistent with "Warm & Human" as a brand statement, not just a palette.
- **Plan**: next holiday, now a real entry point into the fuller Calendar/agenda view
  instead of a dead end.

No new navigation destinations are introduced — every deep link in this IA points at a
screen that already exists (Profile, Leave, Tickets tab, Calendar, Lifestyle via its
existing More-menu screen, reached now from two places instead of one).

## Manager Home information architecture

Scoped deliberately narrow, per [10](10-home-experience-audit.md)'s cross-cutting finding
that "manager" (`has_manager_scope`) and "service-desk agent" (`service_desk.view`) are
unrelated permission axes — this IA only covers the former. **Revised this pass**: the
initial manager-home implementation is now **Team at a glance only** — Approvals is
deliberately separated out into its own, later, independently-approved phase (see below),
not a second element of the same card.

**Team at a glance card** (the one fully-backend-ready addition, and the whole of the
initial Manager IA):
- Visible only when `has_manager_scope === true` on the current session.
- **Informational, read-only, per the actionable/informational taxonomy in
  [10](10-home-experience-audit.md)** — nothing on this card implies a task to resolve.
- Positioned after the signed-in manager's own Pending Actions card, never above it (see
  Proposed Home structure above).
- Content: present/absent/late counts and pending-leave count for the manager's own
  team scope (direct reports / department, whatever `DashboardService::manager()`
  resolves for this user — no department picker on mobile's first version, unlike web's
  broader browse capability, per [10](10-home-experience-audit.md) item 10's access-rules
  note).
- Tapping the card: no destination screen exists yet on mobile to "drill into" team
  detail (web's `ManagerDashboardView` has one; mobile does not) — **this card is
  read-only summary data for its first version**, not a navigation entry point. Building a
  "team detail" screen is a larger, separate mobile development effort, not bundled into
  this card's first version.

**Approvals — explicitly deferred, not part of this phase.** An earlier draft of this IA
treated Approvals as a secondary element bundled into the Team-at-a-glance card (a count
or adjacent badge). That bundling is withdrawn this revision. Reasoning:

- Approvals is **actionable** (per the taxonomy in [10](10-home-experience-audit.md)) —
  unlike the read-only team summary, it would let a manager take a real action
  (approve/reject/request-changes) from mobile for the first time ever. Shipping an
  actionable, authorization-sensitive feature alongside a purely informational one in the
  same initial card conflates two very different risk levels.
- The backend authorization path (`ApprovalRequestService::ensureActorCanApproveStep()`,
  `ApprovalVisibility::query()`) and the data-shape of `GET /approvals?status=pending` have
  only been *read* during this audit, never exercised from a mobile client. Before any
  mobile UI commits to them, both need direct verification: that the step-type checks
  behave as read for every workflow configuration in use, and that the list endpoint's
  response shape, pagination, and error cases are suitable for a lightweight mobile teaser
  (not just a full admin-page table, which is what it was built for on web).
- There is no cheap count endpoint (`GET /approvals?status=pending` + reading
  `.meta.total` is a full list-fetch workaround, per
  [10](10-home-experience-audit.md) item 10) — a dedicated count endpoint is the
  recommended backend follow-up before Approvals becomes a mobile feature, not a
  blocking requirement, but worth sequencing ahead of the mobile work if the backend team
  has capacity, to avoid shipping the workaround and then immediately replacing it.

Approvals therefore has **no card, no position, and no implementation phase in this
document** — it is tracked as a named future phase in
[12-home-expansion-plan.md](12-home-expansion-plan.md), explicitly gated on the
verification above, separate from and not blocking the Team-at-a-glance card.

**Explicitly excluded from Manager Home, with reasoning:**
- Team tickets — `service_desk.view` is the agent axis, not the manager axis (see
  cross-cutting finding); would misfire for managers without that permission and is
  redundant for agents who already have the Tickets tab. Not proposed.
- Team payroll/team assets — confirmed **no backend manager-scope exists** for either
  domain (not "needs more research," confirmed absent) — out of scope until/unless that
  backend work is separately commissioned and approved.
- Onboarding approval — gated by `employees.update`, an HR/admin permission tier, not
  `has_manager_scope` — this is HR-admin tooling, which
  [09-scope-boundaries.md](09-scope-boundaries.md) already excludes from mobile scope; this
  audit does not reopen that exclusion.
- A full "team roster" / direct-reports list screen — `/dashboard/manager`'s payload
  already includes a roster (per the web research), but building a dedicated mobile
  screen for it is new mobile development beyond a Home card and is left for a future,
  separately-scoped phase if the Home card proves valuable first.

## What this explicitly does not do

- It does not propose any change to `ModuleEntitlementService`, any permission string, or
  any authorization middleware — every feature actually proposed for implementation in
  this phase already has a working, read-confirmed authorization path (Team at a glance,
  Lifestyle, notification deep-links, the corrected pending-actions deep-links). Approvals
  is deliberately not among them this pass (see Manager IA above); team tickets and team
  payroll/assets are explicitly flagged as requiring separately-approved backend work.
- It does not touch Login or any of the other 27 non-Home mobile screens.
- It does not implement anything — per [10](10-home-experience-audit.md)'s framing, this
  is the proposal to review before [12](12-home-expansion-plan.md)'s phases begin.
