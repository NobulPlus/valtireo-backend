# 09 — Scope boundaries: visual redesign vs. future manager/HR/admin features

## What this spec is

A presentation-layer specification: colors, type, spacing/radius/elevation, a handful of
reusable component shapes, and two screens' re-skinned layouts. Per audit `05` §1's
confirmation, this is architecturally independent of `ModuleEntitlementService` (the single
source of truth for module visibility/access, audit `01` §1.2), the four auth/tenancy
middlewares, and the approval engine — a token-value swap and a component consolidation pass
change zero lines in any of those. Nothing in this spec is an entitlement, permissions, or
workflow change.

## What is explicitly out of scope, and why it matters to say so

1. **No new screens, modules, or employee-facing features.** [04](04-screen-specifications-login-home.md)
   re-skins Login and Home as they exist today; it adds no new card, section, or data point to
   either screen. The 5 "future module" entries in [01](01-color-tokens.md) §5
   (`recruitment`/`performance`/`learning`/`financial_admin`/`ai_assistant`) exist in this spec
   **only as accent-color reservations** for modules that are currently unbuilt catalog rows
   (audit `01` §1.2) — defining their color now means a future module doesn't need a separate
   design-system change just to pick a color, not that building those modules is part of this
   work.
2. **No manager/HR/admin surface changes.** This spec's component specs
   ([03](03-component-specifications.md)) are written against the **employee self-service**
   screens that exist in `mobile/` today. Nothing here proposes or assumes manager-approval
   flows, HR-admin dashboards, or platform-admin tooling on mobile — those don't exist on mobile
   yet (the mobile app's scope has consistently been employee self-service, per this session's
   earlier `mobile/` build-out), and this redesign doesn't expand that scope. If/when manager or
   admin features are built for mobile, they consume the same token file
   ([07](07-cross-platform-token-architecture.md)) and the same component specs — but designing
   *those* screens is a separate, future task, not a deliverable here.
3. **No change to client's or the platform-admin's functional workflows.** Phase 4
   ([08](08-migration-plan-and-regression-checkpoints.md)) touches `client/`'s *tokens* and
   *shared UI components'* values — it does not touch any feature page's logic, any API
   contract, or any admin-only workflow (user management, workspace settings, platform module
   provisioning). A button's color changing is not a feature change to what the button does.
4. **No backend changes beyond the two already-identified default-value constants**
   ([05-organization-branding-compatibility.md](05-organization-branding-compatibility.md) §2
   item 1, §3) — `WorkspaceSettingsService.php`'s default `primary_color`. Nothing else in
   `server/` is implicated by a visual redesign.
5. **Pre-existing, unrelated findings stay unrelated.** Backend test-suite performance and the
   `app:verify-production-safety` gate (both already addressed in the pre-launch-readiness work
   this session) are explicitly not re-opened or re-scoped by this spec — audit `05` §4 already
   concluded they're independent of the redesign, and nothing in researching this spec changes
   that conclusion.

## The test for "is this in scope"

If a proposed change only affects *how something looks* (color, type, spacing, which shared
component renders it) and not *what a user can do or see data-wise*, it's in scope for this
spec and its migration plan. If it would change *what appears on a screen that isn't there
today*, *who can access what*, or *any API/behavior*, it belongs to a separate, future
specification — this document should be cited as the design-token and component foundation that
future work builds on, not expanded in place to cover it.
