# 03 — Current Feature Inventory & Gap Analysis

This document separates **what exists in the repository today** (verified by reading the code) from **what Orbit needs to add**. Nothing here is based on website copy or prior planning docs.

## Confirmed existing building blocks

| Capability | Exists today? | Where |
|---|---|---|
| Multi-tenant organizations | Yes, but **manually scoped per query** — no Eloquent global scope for `organization_id` exists anywhere in `app/` | `app/Models/Organization.php`; e.g. `EmployeeController.php` repeats `->where('organization_id', ...)` at lines 67, 131, 315, 609 |
| Per-organization module entitlement | Yes, real, working | `platform_modules` + `organization_modules` tables, `app/Services/ModuleEntitlementService.php`, `app/Http/Middleware/EnsureModuleIsSubscribed.php` |
| Org-scoped roles/permissions (Spatie, teams) | Yes | `config/permission.php` (`teams: true`, `team_foreign_key: organization_id`), `app/Http/Middleware/SetPermissionsTeamId.php`, `app/Services/DefaultRoleSeedingService.php` (8 seeded roles) |
| Custom org-created roles | Yes, with escalation guardrails | `app/Http/Controllers/Api/RoleController.php` → `app/Services/RoleManagementService.php` (`assertGrantable`, lockout prevention) |
| Active-employee / suspended-org auth gating | Yes, enforced per-request | `app/Models/User.php::accessIsBlocked()`, `app/Http/Middleware/EnsureOrganizationIsActive.php` |
| Manager/department employee-visibility scoping | Yes | `app/Services/EmployeeVisibility.php`, `app/Http/Middleware/EnsureEmployeeVisibility.php` |
| Generic automatic audit trail | Yes (package) | `owen-it/laravel-auditing`, `audits` table, `Auditable` trait on `Organization`/`Role`/`User`/etc. |
| Narrative/human-readable activity logs | Yes, per-feature, same pattern repeated | `RoleActivity`+`RoleActivityService`, `EmployeeProfileActivity`+`...Service`, `TicketActivity` |
| Audit/activity admin UI | Yes | `client/src/features/audit/AuditActivityPage.tsx` → `GET /audit-logs`, `GET /activity-feed` |
| Generic polymorphic approval workflow | Yes, reused across 5 feature types already | `ApprovalRequest`/`ApprovalWorkflow`/`ApprovalWorkflowStep`/`ApprovalDecision`, `ApprovalRequestService::act()` |
| Generic private file delivery pattern | Yes, but duplicated per controller, **no shared service/model** | `Storage::disk('local')` + `response()->file()`/`->download()`, repeated in `EmployeeDocumentController`, `EmployeeController::photo`, `ConnectChatController::photo` |
| Generic "Attachment" model | **No** — confirmed zero matches for `Attachment`/`Upload` models | Each feature owns its own file columns (Documents, Tickets' `ticket_comments`, Connect's `connect_messages`) |
| Threaded comment replies | Yes, in Connect only | `connect_messages.reply_to_id` self-referencing FK |
| Mentions | Yes, in Connect only | `connect_messages.mentions` (json), cleared for `direct` kind conversations |
| Reactions | Yes, in Connect only | `connect_reactions` table |
| Content moderation/reporting | Yes, in Connect only | `connect_reports` table, `ConnectReportsScreen.tsx` |
| In-app notifications | Yes | Laravel's built-in `notifications` table, `NotificationDispatchService`, `ValtireoNotification` |
| Mobile push notifications | Yes | `device_push_tokens` table, `ExpoPushChannel` (Expo push API) |
| Mobile push deep-linking | Yes, explicit allowlist pattern | `mobile/src/lib/notificationNavigation.ts::resolveNotificationDestination()` |
| Background jobs (queued) | **No** — confirmed zero `app/Jobs` directory, zero `ShouldQueue` classes anywhere | Queue connection (`database`) and `queue:work`/`schedule:work` processes exist in the Docker `supervisord.conf`, but nothing has ever been dispatched onto them |
| Scheduler | Yes, closure-based, `bootstrap/app.php::withSchedule()` | `valtireo:send-reminders` (daily), `valtireo:run-operational-automations` (hourly), `connect:reconcile*` (every minute) |
| Realtime (websockets) | **No** — no Reverb/Pusher config found; both web and mobile Connect use polling | `client/src/features/connect/` polls every 4–10s; `/notifications/unread-count` polls every 60s |
| Web permission/module gating UI pattern | Yes, well-established | `client/src/context/AuthContext.tsx::hasPermission()/moduleByKey()`, `navConfig.ts`, `RequirePermission.tsx` |
| Mobile module gating UI pattern | Yes, well-established | `MainTabs.tsx` conditional `<Tab.Screen>` registration, `moreMenuItems.ts` |
| Deployment infra | Generic Docker (nginx+php-fpm+supervisor), **no named PaaS config found anywhere in the repo** | `server/Dockerfile`, `server/docker/supervisord.conf` |

## What Orbit must build from scratch

Nothing listed above is itself "Orbit" — these are the reusable foundations. Orbit genuinely needs new, net-new pieces:

1. **Workspace → Project → Work item hierarchy** — no equivalent exists anywhere (Operations Centre's `OperationTask` is flat, single-level, system-created; see [02](02-operations-centre-vs-orbit-boundary.md)).
2. **Boards with configurable columns, drag-and-drop ordering, and swimlanes** — nothing like this exists; Tickets has a fixed status workflow, not a configurable board.
3. **Backlog and iterations (sprints)** — no concept of a sprint/iteration exists anywhere in the codebase.
4. **Epics, story templates, acceptance criteria, estimates** — net new fields/concepts.
5. **A workspace/project-level membership-and-role layer** *distinct from* org-wide Spatie permissions — today's Spatie roles are organization-wide; nothing in the app currently models "admin of this one workspace, contributor on that other one." Connect's closest analog (`owner_id` on a conversation) is single-owner, not a role spectrum, and doesn't generalize to "Project Administrator vs. Contributor vs. Viewer." See [06](06-permissions-privacy-tenant-isolation.md) §3.
5. **A fractional/position-based ordering column with concurrency-safe drag-and-drop** — no board/list ordering problem has existed in this codebase before now; see [07](07-database-design-and-migrations.md) §7.
6. **Work-item key generation (`PROJ-124`)** — net new; the closest existing precedent for a safe per-tenant incrementing counter is the row-locking pattern already used in `User::createToken()` (`lockForUpdate()` before a check-then-write), which Orbit's key generator reuses directly.
7. **A generic, permission-safe "link to an existing Valtireo entity" model** — the closest existing precedent is `ApprovalRequest`'s `approvable_type`/`approvable_id` morph, but that's a 1:1 "this approval belongs to exactly one thing" relationship. Orbit needs a many-to-many-shaped "this work item references zero-or-more existing records" link table — genuinely new.

## Gaps that affect sequencing (not Orbit-specific, but Orbit will be the first module to hit them)

- **No queued job infrastructure has ever been exercised.** Orbit's due-date reminders, overdue escalation, and iteration start/end reminders are good first real candidates for actual `ShouldQueue` jobs — but this means Orbit's Phase 1 will be the first code in the whole app to prove out the `database` queue driver end-to-end in production. Budget time for this; see [10](10-notifications-audit-files-jobs.md) §5 and [12](12-risks-edge-cases-testing.md).
- **No Eloquent global tenant scope exists**, and the one confirmed real-world bug in this exact class ("My Assets leaked the whole org's asset list to privileged viewers," fixed in commit `cd5b14a`) shows the manual-`where()`-everywhere convention is a genuine, demonstrated risk, not a theoretical one. Orbit is a good, low-risk place to introduce a `BelongsToOrganization` trait + global scope as a safety net, without having to retrofit the rest of the app. See [06](06-permissions-privacy-tenant-isolation.md) §1.
