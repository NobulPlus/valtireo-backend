# 15 — Executive Summary

**Orbit** (formerly referred to during discovery as "Valtireo Work Management") is a proposed new, separately-entitled module giving every team — not just engineering — a place to plan and track work: lightweight boards and tasks for non-technical teams, and a structured backlog/epic/sprint model for product and delivery teams, under one shared Organization → Workspace → Project → Work Item hierarchy.

## Why now, and why separate from Operations Centre

Valtireo already has an Operations Centre, but it's a different kind of system entirely: it's a **system-generated compliance/follow-up inbox** (document expiry, SLA breaches, onboarding gaps), confirmed in code to be driven by an automation rule engine (`OperationAutomationService`) and a time-based scanner, with no board, no backlog, no sprints, and no mobile presence. Orbit is **human-planned, proactive work tracking** — the opposite shape. Keeping them separate, with one deliberate, user-initiated "link" bridge between them, avoids the single biggest risk called out in this discovery: Operations Centre quietly becoming a general task manager, or Orbit quietly duplicating Operations Centre's automation engine.

## What this package covers

Fifteen documents plus this summary, each grounded in direct reads of the actual Valtireo codebase — not assumptions from prior documentation or marketing copy:

- A product requirements document and an explicit Operations-Centre-vs-Orbit boundary rule.
- A feature inventory separating what Valtireo already has (module entitlements, org-scoped Spatie permissions, manager-visibility scoping, a generic audit package, a private-file-delivery pattern, Connect's threaded-reply/mention/reaction/moderation tables, Expo push notifications) from what Orbit genuinely needs to build (the workspace/project hierarchy, boards, backlog/iterations, a new workspace/project membership-role layer, a generic record-linking model, and concurrency-safe key generation and ordering).
- User journeys for an employee contributor, a delivery team lead, and an organization administrator.
- Web and mobile information architecture that deliberately keeps workspace/project administration, workflow configuration, and sprint planning **web-only** — matching the existing precedent that Operations Centre, Role management, and the Audit log already have no mobile screen.
- A detailed permissions and tenant-isolation model, including one specific hardening recommendation: Orbit should be the first module to adopt an automatic organization-scoping safety net (a `BelongsToOrganization` trait), since the one confirmed real cross-tenant data leak in this codebase's history ("My Assets leaked the whole org's asset list") was exactly this bug class, and today's convention of manually repeating `where('organization_id', ...)` in every query offers no structural protection against it recurring.
- A complete relational database design, API contract, reusable-component map, and notification/audit/file/job design — each explicitly citing which parts of Orbit can reuse existing Valtireo infrastructure as-is (module gating, permissions, file delivery, avatars, the audit package, push notifications) versus which parts are genuinely new to this codebase (drag-and-drop ordering, the record-linking model, workspace-scoped roles, and — flagged candidly — the first real use of this app's never-yet-exercised background job queue).
- A phased plan: an MVP scoped to Kanban/Simple-mode projects with full permissions, linking, comments, and notifications; Scrum/backlog/iterations in Phase 2; templates/dependencies/dashboards in Phase 3; portfolio and external-guest access — each gated on its own review — in Phase 4.
- Risks, edge cases, and a concrete test plan matching this codebase's existing Feature-test conventions, plus exact acceptance criteria and exact expected file paths for every phase.

## What was deliberately not done

No code was written. No migrations, models, controllers, routes, screens, roles, permissions, seed data, dependencies, or commits exist for Orbit as a result of this discovery pass. This is the review checkpoint called for before any Phase 1 implementation work begins.

## Recommended next step

Review this package, confirm the Operations-Centre boundary and the membership-role permission model (the two decisions with the most downstream implementation impact), and approve Phase 1's scope before any migration is written.
