# Orbit — Discovery, Product Design & Architecture

Orbit is Valtireo's team-planned work-management module (as opposed to Operations Centre, which is system-generated compliance/follow-up work — see [02](02-operations-centre-vs-orbit-boundary.md)). Internally (module key, table prefixes, route prefixes, folder names) it is `orbit`.

## Status: partially shipped, not "documentation-only"

This folder originated as a **pre-implementation discovery package** — documents `01`–`15` below describe the product's *original design intent*, written before a single line of Orbit code existed. That is no longer true. A substantial Orbit module now exists in `server/`, `client/`, and `mobile/`. Documents `01`–`15` are kept as the historical record of what was planned; they are **not** a reliable description of what's live today. Treat any claim in them of the form "nothing has been built" as describing the state of the repo in 2026-11, not now.

For an accurate, code-verified picture of what's actually shipped, partial, or not started, see the table below.

### What's shipped and working (web + backend; mobile noted separately)

- Workspace → Project → Work item hierarchy, with workspace- and project-level membership roles (admin/contributor/viewer) layered on top of org-wide `orbit.*` Spatie permissions.
- Module subscription gating (`orbit.access` + per-org subscription, both enforced).
- Kanban boards: configurable statuses, drag-and-drop ordering, optimistic concurrency via a `version` field.
- Work items: create/edit (title, type, priority, assignee, labels), comments with mentions, private attachments, work-item links, narrative activity logging.
- Sprint/iteration lifecycle for `scrum`-mode projects: create/edit a planned sprint, start it (one active sprint per project, enforced), complete it with unfinished work carried to a chosen planned sprint or back to the backlog (`orbit_iteration_carryovers`). Project-creation UI now actually offers Scrum mode (it was incorrectly disabled as "coming soon" until 2026-11-12, after sprints had already shipped).
- Multi-tenant isolation via an automatic organization-scoped Eloquent trait on Orbit models (stronger than the manual `where('organization_id', ...)` convention used elsewhere in the app — see [06](06-permissions-privacy-tenant-isolation.md) §1 for why that gap mattered).
- Mobile: My Work, assigned items, board/project browsing (read), status change, comments, notifications.

### Partial — exists but incomplete

- **Scrum is sprint-lifecycle-only.** No backlog screen, sprint planning view, epics, estimates UI, acceptance-criteria field in the UI, or sprint reporting (planned/completed/incomplete breakdown, scope-change count) exist yet, even though the backend accepts some of these fields and the original MVP plan ([11](11-mvp-and-phase-plan.md)) scoped most of this to "Phase 2." Sprints shipped ahead of the rest of that phase.
- **Simple mode isn't actually simple.** It renders the identical draggable Kanban board as `kanban` mode — there is no flat, non-technical task-list experience yet, despite that being the stated point of the mode.
- **Work-item detail modal exposes a fraction of what the API supports.** The API can update title, priority, assignee, dates, estimates, and labels; the web detail modal mainly surfaces comments, attachments, links, and (now) sprint assignment.
- **Watch/follow is backend-only.** Endpoints and notifications exist; there are no web controls to watch/unwatch an item or see who's watching.
- **My Work routes to the project board, not the item.** Clicking a task from My Work should open that task directly.
- Threaded comment replies, full activity-history display, definition-of-done, story templates, and the "create linked Orbit item" bridge from Operations Centre are stored/designed for but not surfaced in the UI.

### Not started

- Reporting of any kind beyond My Work and the project activity feed (no cross-workspace or cross-project views).
- Board filtering and swimlanes.
- The scheduled job that would actually dispatch due-soon reminders — the notification service is ready, but nothing on the scheduler invokes it yet.
- Mobile sprint/backlog screens (explicitly deferred — see the sprint implementation note below).
- `orbit.reports.view_all` and `orbit.admin.manage` permissions were seeded but never checked anywhere in `app/`; they were removed on 2026-11-12 rather than left as dead, misleading grants. Reintroduce them only alongside the reporting/admin screens they were meant to gate.

## Reading order (original discovery package — design intent, not current state)

1. [01 — Product Requirements](01-product-requirements.md)
2. [02 — Operations Centre vs. Orbit Boundary](02-operations-centre-vs-orbit-boundary.md)
3. [03 — Feature Inventory & Gap Analysis](03-feature-inventory-and-gap-analysis.md)
4. [04 — User Journeys](04-user-journeys.md)
5. [05 — Information Architecture (Web & Mobile)](05-information-architecture.md)
6. [06 — Permissions, Privacy & Tenant Isolation](06-permissions-privacy-tenant-isolation.md)
7. [07 — Database Design & Migration Plan](07-database-design-and-migrations.md)
8. [08 — API Contract Proposal](08-api-contracts.md)
9. [09 — Reusable Components & Integration Points](09-reusable-components-and-integration-points.md)
10. [10 — Notifications, Audit, Files & Background Jobs](10-notifications-audit-files-jobs.md)
11. [11 — MVP & Phase Plan](11-mvp-and-phase-plan.md)
12. [12 — Risks, Edge Cases & Testing Strategy](12-risks-edge-cases-testing.md)
13. [13 — Implementation File Plan](13-implementation-file-plan.md)
14. [14 — Acceptance Criteria](14-acceptance-criteria.md)
15. [15 — Executive Summary](15-executive-summary.md)
