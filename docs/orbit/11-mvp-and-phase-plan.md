# 11 — MVP & Future Phase Plan

## MVP (Phase 1)

| Area | In MVP |
|---|---|
| Entitlement | `orbit` module row, opt-in per organization |
| Hierarchy | Workspaces, projects (`kanban`/`simple` modes only — see note below), work items |
| Permissions | Org-wide `orbit.*` permissions + workspace/project membership roles (admin/contributor/viewer) |
| Board | Configurable columns, drag-and-drop (web), filters (assignee/type/label/priority/due date), audited moves |
| Work items | task/bug/story (simple, non-epic-linked), assignee, priority, dates, labels, checklists-via-subtasks, acceptance criteria field |
| Collaboration | Comments with threaded replies and mentions, private attachments, watch/follow |
| Links | Basic link model to Tickets/Assets/Documents/Leave/Operation Tasks (metadata-only, permission-safe) |
| Notifications | Assignment, mention, comment, due date, status movement — delivered via existing notification/push pipeline |
| Audit | Generic field auditing + narrative activity log, surfaced in the existing Audit page |
| Mobile | My Work, assigned items, comment, status change (picker, not drag), board/project browsing (read), notifications, create a basic task where authorized |
| Reporting | None beyond "My Work" and project activity feed |

**Note on Scrum mode**: the spec lists Scrum (backlog/iterations/epics/estimates/iteration reporting) as part of the required capability inventory, but its own MVP boundary section defers backlog/iterations/epics/estimates to Phase 2. This document follows the spec's explicit MVP boundary, not the capability inventory, where the two disagree — **Scrum mode, backlog, iterations, epics, and estimates are Phase 2**, not MVP. MVP ships `kanban` and `simple` project modes only. The database design ([07](07-database-design-and-migrations.md)) includes the Scrum-related tables now (iterations, epic_id, estimate columns) because retrofitting them onto a live `orbit_work_items` table later is far more disruptive than shipping unused-but-ready columns/tables from day one — but the UI, API endpoints, and permission checks for backlog/iteration management are Phase 2 work, not built or exposed in Phase 1.

## Explicitly deferred from MVP (per spec, confirmed still correct after codebase review)

Gantt charts, dependency graphs, portfolio management, complex custom fields, advanced time tracking, full external guest support, burndown/velocity forecasting, AI backlog generation, deep Connect coupling, video meetings inside Orbit, automatic bulk conversion of Operations Centre tasks, full mobile administration/sprint planning, comment/attachment moderation-and-reporting (Connect's `connect_reports` shape, deferred until there's a demonstrated need), general cross-feature notification preferences (an app-wide concern, not Orbit's to solve alone).

## Phase 2 — Scrum delivery

- Activate `scrum` project mode: backlog view, epics, iterations (create/start/complete/close), estimates, iteration planning view, basic iteration reporting (planned/completed/incomplete, estimate totals, scope-change count — no velocity/burndown yet).
- Carry-forward of incomplete work between iterations (`orbit_iteration_carryovers`, already in the Phase 1 schema).
- "Create linked Orbit work item" bridge action from Operations Centre (see [02](02-operations-centre-vs-orbit-boundary.md)).
- Reactions on comments (reuse `connect_reactions`' shape).
- Comment/attachment reporting-and-moderation (reuse `connect_reports`' shape), if usage shows it's needed.
- Promote Orbit from a `MoreTab` menu row to its own mobile bottom tab, if usage data supports it.

**Dependencies**: Phase 2 depends on Phase 1's schema (already includes iteration/epic/estimate columns) but not on any Phase 1 UI — it's purely additive screens and endpoints. **Complexity**: medium — iteration start/complete transitions and carry-forward auditing are the trickiest new logic; everything else (epics, estimates) is mostly new fields on an existing model plus new filter options on an existing board.

## Phase 3 — Templates, dependencies, dashboards, expanded mobile

- Project templates (clone a project's statuses/labels/workflow into a new project).
- Work-item dependencies ("blocks"/"blocked by" — a new, lightweight self-referencing relation table, distinct from `parent_id`/`epic_id`).
- Advanced reporting dashboards (cross-project, cross-workspace, using the existing `client/src/components/ui/Charts.tsx`/`StatTile.tsx` components rather than a new charting primitive).
- Expanded mobile: possibly backlog browsing (read-only), simple iteration status viewing.

**Dependencies**: needs Phase 2's iteration data to have accumulated enough history for dashboards to be meaningful. **Complexity**: medium-to-high for dependencies (status-transition validation gets genuinely more complex once items can block each other); low-to-medium for templates and dashboards.

## Phase 4 — Portfolio/roadmap, external collaboration, optional intelligence

- Portfolio/roadmap views across workspaces.
- External guest access model (deferred from every earlier phase per the spec's own caution — needs a dedicated security review before any design work starts, since it's the first time a non-employee would get any access to this app at all).
- Any AI-assisted feature (backlog generation, auto-summarization) — explicitly gated on separate product approval per the spec, not something this discovery package scopes.

**Dependencies**: external guest access is a prerequisite-gating decision for anything portfolio-across-organizations-shaped; it should not be designed as a side effect of a portfolio feature. **Complexity**: high — this phase is the one most likely to need new infrastructure (external identity, a different auth model) rather than extending existing patterns.
