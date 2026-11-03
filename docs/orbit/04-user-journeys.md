# 04 — User Journeys

Three personas, matching the roles the spec calls out conceptually, and mapped to the real permission/module-gating mechanisms confirmed in the codebase ([06](06-permissions-privacy-tenant-isolation.md) has the full permission table).

## Journey A — Employee / Project Member (non-technical, HR teammate)

**Context**: Amaka is an HR Officer. Orbit is enabled for her organization (`organization_modules` row for `orbit`, status `active`). She's been added as a Contributor on the "HR" workspace's "Onboarding Checklist" project, which runs in **Simple tasks** mode.

1. Logs into web, sees **Orbit** appear in the Sidebar's `Core` or `My workspace` nav group (gated by `moduleByKey('orbit')?.visibility === 'enabled'` — same mechanism every other module nav item already uses) only because her org is subscribed; otherwise the item simply doesn't render, matching the existing `comingSoon`/hidden pattern in `navConfig.ts`.
2. Opens the "Onboarding Checklist" project → sees a flat task list, not a board with columns labeled "To Do/In Progress/Done" unless she chooses to view it as a board. No "Epic," "Story points," or "Sprint" language anywhere — the project's `mode = 'simple'` suppresses those fields entirely in both the create-item form and the detail view.
3. Creates a task ("Collect signed offer letter — new hire Tunde A."), assigns it to herself, sets a due date, no estimate field is shown.
4. A colleague comments "Already in the drive, I'll attach it" and attaches a file — reusing the same private-file-delivery pattern as Documents (download/view gated by org + membership check, never a public URL).
5. Gets a notification when the task's due date is tomorrow (reusing `NotificationDispatchService`, delivered via the existing 60s-poll unread-count mechanism, no new infra).
6. On mobile, opens the **More → Orbit** menu row (not its own tab — mirrors how Assets/Payslips/Documents already live under `MoreTab` rather than getting a dedicated tab, per `mobile/src/lib/moreMenuItems.ts`'s existing convention), sees her assigned tasks under **My Work**, marks the task done from her phone. She cannot create a new project or configure board columns from mobile — those stay web-only, deliberately, matching the precedent that Operations Centre, Role management, and the Audit log already have no mobile screen at all.

## Journey B — Manager / Project Administrator (delivery team lead)

**Context**: Chidi is an Engineering Lead. He has the org-wide `orbit.workspaces.create` permission (granted via a custom role, or added to an existing role like Department Head) and is Workspace Administrator of "Product & Engineering."

1. Creates a new workspace "Product & Engineering" (if not already created by an org admin), then a project "Mobile App Redesign" in **Scrum** mode, choosing a project key prefix `MOBI` (validated unique per organization — see [07](07-database-design-and-migrations.md) §6).
2. Adds team members as Project Members with roles: himself as Project Administrator, two engineers as Contributors, one stakeholder as Viewer. This membership role is **separate from** their org-wide Spatie role — an engineer who is a Contributor on this project could independently be a Viewer on a different project in a different workspace. (See [06](06-permissions-privacy-tenant-isolation.md) §3 for why this needed a new layer, not reuse of Spatie roles directly.)
3. Creates an epic "Redesign onboarding flow," then stories under it with the structured "As a [user], I want..., so that..." template, acceptance criteria, and estimates.
4. Opens the Backlog, drags stories into a new iteration "Sprint 14" (start/end dates, a goal, optional capacity note), starts the sprint.
5. Reviews the Board daily — drags cards across configured columns (To Do → In Review → Done), each move recorded with previous/new state in the work item's activity history (reusing the same `*Activity` + `*ActivityService::record()` pattern already used by `RoleActivity`/`TicketActivity`).
6. Links one story to an existing Documents entry (the design spec PDF) and to an open Ticket (a bug a user filed that this story will fix) — using the generic link model, never granting the story's other viewers any new access to that ticket or document; they still need their own permission to open it.
7. At sprint end, closes "Sprint 14": completed items are marked done, incomplete items are explicitly, auditably carried into the next iteration (not silently re-parented) — matches the spec's "intentional carry-forward" requirement.
8. Pulls up basic iteration metrics (planned vs. completed vs. incomplete counts, estimate totals, scope-change count) for a one-line standup update. No velocity chart — deferred.

## Journey C — Organization Administrator (entitlement & oversight)

**Context**: the org admin, who already has `organizations.administer` (giving them Organization Admin's "all permissions" per `DefaultRoleSeedingService`).

1. Sees Orbit listed as a subscribable module alongside Leave/Payroll/Connect/etc. in the organization's module-management screen (wherever `organization_modules` subscriptions are currently administered — same screen, same flow, no new UI pattern).
2. Subscribes the organization to Orbit; it immediately appears for any employee whose role grants `orbit.access`.
3. Grants the `orbit.workspaces.create` permission to the "Department Head" role via the existing Role management screen (`client/src/features/settings` role editor → `RoleController`/`RoleManagementService`) — no Orbit-specific role UI needed; it's governed by the same custom-role permission picker every other permission uses.
4. If a Workspace Administrator leaves the organization or is offboarded, the org admin can reassign workspace/project administration **without bypassing linked-record permissions** — i.e., becoming the new Workspace Administrator does not retroactively grant the admin visibility into a linked payroll exception they didn't already have permission to see (see [06](06-permissions-privacy-tenant-isolation.md) §8, "organization administrators do not bypass sensitive linked-record permissions").
5. Views Orbit's slice of the organization's Audit log (`AuditActivityPage.tsx`) to see workspace/project/role changes — reusing the existing audit UI, not a new Orbit-specific audit screen.
