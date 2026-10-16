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
[10](10-home-experience-audit.md)) made interactive where it previously wasn't.

1. Header — unchanged.
2. **NEW — Team at a glance card** (conditional on `has_manager_scope`, see Manager IA
   below) — positioned directly under the header, above Quick Access, so it reads as "the
   one thing that's different about your Home because you're a manager," not buried among
   employee content.
3. Quick access card — unchanged tiles, same gating.
4. Pending actions card — same data, **now tappable per item** (deep-links to Profile /
   Leave / Tickets depending on `action.key`, per [10](10-home-experience-audit.md) item 1
   — pending verification of `leave_approval`'s exact semantic before wiring that one key).
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
logic — the only structural change for non-managers is two new possible cards (Lifestyle,
and tappability on two existing ones); the only structural change for managers is one
additional card at the top.

## Employee Home information architecture

The employee's Home remains what it is today — a single-scroll personal dashboard, no
tabs, no sections requiring horizontal navigation — with the gaps in
[10](10-home-experience-audit.md) closed:

- **Act** (top of the interactive hierarchy): pending actions, now navigable.
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
unrelated permission axes — this IA only covers the former.

**Team at a glance card** (the one fully-backend-ready addition):
- Visible only when `has_manager_scope === true` on the current session.
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

**Approvals** (secondary, same card or a small adjacent badge — design decision left to
implementation, not fixed here): a count/teaser sourced from `GET
/approvals?status=pending`, filtered to requests this manager can act on. Given there's no
cheap count endpoint (per [10](10-home-experience-audit.md) item 10), this should be
implemented as a *light* list fetch (small `per_page`, just enough to get `.meta.total` and
maybe the first 1-2 items' labels) rather than pulling a full page — flagged explicitly as
a performance trade-off to accept for v1, with a cheap backend count endpoint recommended
as a follow-up (see [12](12-home-expansion-plan.md)).

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
  any authorization middleware — every proposed feature either already has a working
  authorization path (Team at a glance, Approvals, Lifestyle, notification deep-links) or
  is explicitly flagged as requiring separately-approved backend work (team tickets,
  team payroll/assets).
- It does not touch Login or any of the other 27 non-Home mobile screens.
- It does not implement anything — per [10](10-home-experience-audit.md)'s framing, this
  is the proposal to review before [12](12-home-expansion-plan.md)'s phases begin.
