# 01 — Orbit Product Requirements Document

## 1. What Orbit is

Orbit is a new, separately-entitled Valtireo module for team and delivery work management. It sits alongside the existing modules (`leave`, `attendance`, `service_desk`, `assets`, `payroll`, `employee_self_service`, `connect`, `documents` — confirmed module keys seen in `client/src/context/AuthContext.tsx`'s `moduleByKey()` consumers) as a new catalog entry in `platform_modules` with key `orbit`.

Orbit gives any team — not just engineering — a place to track work, from a simple personal to-do list up to a structured Scrum delivery board. It is intentionally **not** an extension of Operations Centre; see [02 — Operations Centre vs. Orbit Boundary](02-operations-centre-vs-orbit-boundary.md) for the dividing line.

## 2. Hierarchy

```
Organization
 └─ Workspace            (a function or team: "Product & Engineering", "HR", "Finance"...)
     └─ Project          (operating mode: kanban | scrum | simple)
         └─ Work item     (epic | story | bug | task | subtask)
             ├─ Comments
             ├─ Attachments
             └─ Activity history
```

A workspace is a durable grouping (department/function-shaped, long-lived). A project belongs to exactly one workspace. A work item belongs to exactly one project (and therefore exactly one workspace and one organization).

## 3. Operating modes (per project)

| Mode | Fields shown | Who it's for |
|---|---|---|
| **Kanban** | Board columns, labels, priority, due date, checklist | Continuous-flow teams (support, ops, marketing) |
| **Scrum** | Everything in Kanban + backlog, iterations, estimates, epics, acceptance criteria | Product/engineering delivery teams |
| **Simple tasks** | Title, assignee, due date, checklist, comments — no board columns required, flat list view available | Non-technical teams who just need a to-do list |

A project's mode is set once at creation and determines which fields/screens are shown — it does not hide or rename fields globally; it is a **display configuration** read by the frontend, not a different database schema. This directly answers the spec's requirement to avoid forcing agile terminology on every team: an HR project in `simple` mode never renders "Epic," "Story points," or "Sprint" anywhere in its UI, even though the underlying `orbit_work_items` row has the same columns as a Scrum project's.

## 4. Work item model (summary — full schema in [07](07-database-design-and-migrations.md))

Every work item carries: key (`PROJ-124`), title, description, `type` (epic/story/bug/task/subtask), status, priority, reporter, assignee, watchers, project/workspace, `parent_id` (subtask-of-task hierarchy), `epic_id` (explicit epic link, distinct from `parent_id`), labels, due/start dates, estimate/remaining estimate, acceptance criteria, attachments, comments, mentions, links/dependencies, a link to an existing Valtireo entity where relevant, full activity history, and created/updated/completed/archived timestamps.

A **story** supports the "As a [person], I want [goal], so that [outcome]" structured template plus acceptance criteria and a definition of done — implemented as structured text fields on the work item, not a separate table (see [07](07-database-design-and-migrations.md) §2).

## 5. Boards, backlog, iterations

- Configurable columns/statuses per project, drag-and-drop movement, audited every move (previous → new state).
- Board filters: assignee, type, label, priority, epic, iteration, due date. Swimlane grouping by assignee/epic/priority/status.
- Scrum-capable projects get: unscheduled backlog, iteration create/edit/start/complete/close, planning view, carry-forward of incomplete work (auditable), and basic metrics (planned/completed/incomplete counts, estimate totals, scope changes). No velocity forecasting in v1 — explicitly deferred, per the spec's own caution against overpromising.

## 6. Collaboration

Comments with threaded replies (the existing `connect_messages.reply_to_id` self-referencing-FK pattern is directly reusable — see [09](09-reusable-components-and-integration-points.md)), mentions using existing employee/user identities, attachments via a dedicated Orbit attachments table (not a new generic cross-app model — see [07](07-database-design-and-migrations.md) §2 and [09](09-reusable-components-and-integration-points.md)), notifications for assignment/mention/comment/due date/status movement/iteration changes, watch/follow, and consistent names/photos reusing the existing `GET /api/employees/{employee}/photo` pattern. Reactions are deferred to Phase 2+ (reuse of `connect_reactions`' shape is straightforward later, but it's not needed for MVP usefulness). Connect integration ("mention this work item in a Connect message," "jump to the linked conversation") is a Phase 2+ idea, not an MVP dependency.

## 7. Views

Web: My Work, Workspace overview, Project overview, Board, Backlog, Iteration planning, Work item detail, Project activity, basic reporting, admin/settings. Mobile (deliberately smaller): My Work, assigned items, comment/status-change, board/project browsing (read-heavy), notifications, create a basic task/bug where authorized. Full workspace administration, workflow configuration, backlog grooming, and sprint planning stay web-only — mirroring the existing precedent that Operations Centre itself has no mobile screen at all, and that web-only admin screens (Role management, Audit log) are an accepted pattern in this app already.

## 8. Links to existing Valtireo records

An extensible, permission-safe link model: a work item can reference an employee, ticket, asset, document, leave request, payroll exception, or Operations Centre task. The link is one-directional metadata (a polymorphic `linked_type`/`linked_id` row) — it never grants access to the linked record; the linked record is always re-checked against its own permissions at render time, and a missing/forbidden/deleted link fails safely (renders as "Linked record unavailable," never a broken reference or a silent bypass). See [06](06-permissions-privacy-tenant-isolation.md) §7 for the exact failure-safe rule. Creating a link is a deliberate, authorized "Create linked work item" / "Link existing record" action — not automatic conversion of Operations Centre tasks.

## 9. Non-goals for v1 (explicit)

Gantt charts, dependency graphs, portfolio/roadmap views, complex custom fields, advanced time tracking, full external guest access, velocity/burndown forecasting, AI backlog generation, deep Connect coupling, video meetings inside Orbit, automatic bulk conversion of Operations Centre tasks, and full mobile administration/sprint planning. All of these are plausible later phases (see [11](11-mvp-and-phase-plan.md)), not missing requirements.
