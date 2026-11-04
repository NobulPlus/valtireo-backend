# 02 — Operations Centre vs. Orbit: the Boundary

This is the single most important design constraint in this package: **Orbit must not turn Operations Centre into a general task manager, and Operations Centre must not quietly become Orbit's little sibling.** They solve different problems and must stay separable.

## What Operations Centre actually is today (confirmed in code)

Operations Centre is a **compliance/follow-up signal system**, not a work-tracking tool. Concretely:

- `server/app/Models/OperationTask.php` + `server/database/migrations/2026_09_24_010000_create_operations_center_tables.php` — `operation_tasks` rows are created almost entirely **by the system**, not typed in by a person building a backlog. They carry a `source_type`/`source_id` morph back to the thing that caused them (a ticket, a document, a leave request, a payroll run, an employee lifecycle event), a `category`, `priority`, `due_at`, and `status`.
- The creation path is a **rule engine**, not manual entry: `server/app/Services/OperationAutomationService.php::dispatch($trigger, $subject, $context)` matches active `OperationAutomationRule` rows by `trigger` + organization, and for a `create_task` action does a deduplicated `OperationTask::firstOrCreate(...)`. Real trigger call sites: `AssetController` (`asset.assigned`/`asset.returned`), `AttendanceCorrectionRequestController` (`attendance.correction_submitted`), `EmployeeDocumentController` (`document.submitted`/`document.reviewed`), `LeaveRequestController` (`leave.submitted`/`leave.cancelled`), `PayrollRunController` (`payroll.calculated`/`exceptions_detected`/`submitted`/`finalized`), `TicketController` (`ticket.submitted`/`assigned`/`resolved`), `EmployeeLifecycleService` (`employee.status_changed` and onboarding/offboarding triggers).
- A second path is **time-based scanning**: `server/app/Services/OperationalAutomationScanner.php::scan()`, run hourly via `valtireo:run-operational-automations` (registered in `bootstrap/app.php`'s `withSchedule()`), raises `document.expired`/`document.expiring`, `employee.probation_ending`, `ticket.sla_breached`, `payroll.exceptions_detected`, and `operation.task_overdue`.
- The UI (`client/src/features/operations/OperationsCenterPage.tsx`, web-only, no mobile screen at all) is a **triage inbox**: a prioritized list of "things that need a human to look at," with start/complete/reopen/cancel actions — not a board, not a backlog, not an estimate field, not a sprint.

In short: **Operations Centre answers "what fell out of my existing Valtireo workflows that someone needs to follow up on?"** It is reactive and system-driven by design.

## What Orbit is

**Orbit answers "what work is my team planning and doing, on purpose?"** It is proactive and human-driven: a person creates a workspace, a project, and work items; drags cards across a board; plans a sprint. Nothing in Orbit is auto-created by a rule engine scanning for compliance drift.

## The dividing line, stated as a rule

| | Operations Centre | Orbit |
|---|---|---|
| Who creates the item | The system (automation rule or scanner) | A person |
| What it's about | A gap/risk in an *existing* Valtireo workflow | Planned work a team decided to do |
| Typical fields | `source_type`/`source_id`, `due_at`, `priority`, `status` | type, epic/parent, labels, estimate, acceptance criteria, sprint |
| Lives on a board/backlog? | No — a prioritized list only | Yes — Kanban board, backlog, iterations |
| Has its own sub-items/epics/sprints? | No | Yes |
| Mobile support | None today | My Work + basic updates (Orbit v1) |

## The one deliberate bridge: "Create linked work item"

The spec explicitly asks for a link model, not automatic conversion. Concretely: an `OperationTask` detail view in Operations Centre can offer a **"Create linked Orbit work item"** action (visible only to users with both `operations.view` and Orbit project-creation rights) that creates a new `orbit_work_items` row with an `orbit_work_item_links` row pointing back at the `OperationTask` (`linked_type = OperationTask::class`). This is:

- **Opt-in, per-item, user-initiated** — never a bulk job, never automatic.
- **One-directional in effect**: the `OperationTask` is unaffected; it does not change status, get reassigned, or disappear when the linked work item is created. An admin resolves the `OperationTask` itself through Operations Centre's own actions, as always.
- **Not required for Orbit's MVP usefulness** — a team can use Orbit productively with zero Operations Centre integration on day one. This bridge is Phase 2+ polish (see [11](11-mvp-and-phase-plan.md)).

## What this rules out

- Orbit must **not** gain a "scan and auto-create work items" feature of its own — that would duplicate Operations Centre's job with a second, divergent rule engine.
- Operations Centre must **not** gain board columns, sprints, epics, or a backlog — if a team's follow-ups need that much structure, that is a sign they should link to or graduate into an Orbit project, not that Operations Centre should grow those features.
- No migration path is being built to "convert all existing Operations Centre tasks into Orbit work items." The spec explicitly defers this, and nothing about the two systems' very different lifecycles (automated/reactive vs. manual/planned) makes a bulk conversion meaningful.
