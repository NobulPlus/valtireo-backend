# 09 — Reusable Components & Integration Points

The goal of this document: list, with exact file references, what Orbit should **reuse as-is**, what it should **copy the pattern of but build its own instance**, and the one or two things that are genuinely **new primitives** this codebase doesn't have yet.

## Reuse as-is (no new code needed)

| Need | Reused from |
|---|---|
| Module entitlement gate | `app/Services/ModuleEntitlementService.php`, `app/Http/Middleware/EnsureModuleIsSubscribed.php` — just add an `orbit` row to `platform_modules` |
| Org-scoped permission checks | Spatie teams setup already in place (`config/permission.php`, `SetPermissionsTeamId` middleware) — just seed new `orbit.*` permission strings |
| Custom role creation/permission assignment UI | `client/src/features/settings`'s role editor + `RoleController`/`RoleManagementService` — Orbit's new permissions just appear in the existing picker, no new UI |
| Active-employee/suspended-org request gating | `EnsureOrganizationIsActive` middleware — applies automatically to any new route, nothing to build |
| Private file delivery | `Storage::disk('local')` + `response()->file()`/`->download()` pattern from `EmployeeDocumentController::download()/view()` and `ConnectChatController::photo()` — copy the pattern into a new `OrbitAttachmentController` |
| Person photos/avatars | `GET /api/employees/{employee}/photo` (`EmployeeController::photo()`) is already generic-by-person — **Orbit should call this exact existing endpoint directly** for assignee/comment-author avatars rather than building a third copy (Connect already reuses it this way for chat avatars via its own `/people/{person}/photo` route) |
| In-app notification creation/delivery | `app/Services/NotificationDispatchService.php` + `ValtireoNotification` + `ExpoPushChannel` — add new purpose-built methods (`workItemAssigned`, `workItemMentioned`, `workItemDueSoon`, `iterationStarted`, etc.), same file, same pattern |
| Web polling-based data freshness | `@tanstack/react-query`'s `refetchInterval` — Orbit's board/backlog can poll every 5–10s like Connect's messages do, no websockets needed for v1 |
| Design-system components | `client/src/components/ui/{DataTable,StatusBadge,PriorityBadge,Modal,ModalActions,Dropdown,SelectMenu,Pagination,PageHeader,Field,Input}.tsx` — all directly applicable, zero new components required for the backlog table, item detail modal, or status/priority chips |
| Mobile list pagination | `mobile/src/lib/useInfiniteList.ts` |
| Mobile file upload shape | `RNFile { uri, name, type }` |
| Mobile push registration & deep-linking | `mobile/src/lib/pushTokenRegistration.ts`, `mobile/src/lib/notificationNavigation.ts::resolveNotificationDestination()` — extend the existing `switch` with two new destination kinds |
| Audit UI | `client/src/features/audit/AuditActivityPage.tsx` already shows any feature's `*Activity` rows and the generic `audits` table — Orbit's activity automatically surfaces there once `orbit_work_item_activities` exists, no new audit screen needed |

## Copy the pattern, build Orbit's own instance

| Need | Pattern to copy | Why not reuse directly |
|---|---|---|
| Threaded comment replies | `connect_messages.reply_to_id` self-referencing FK + reply-rendering logic in `ConnectMessenger.tsx` | Comments belong to work items, not conversations — different parent entity, same shape |
| @Mentions parsing | Connect composer's `@name` regex-match-to-user-id logic (`client/src/features/connect/ConnectMessenger.tsx`'s `Composer`) | Same UX, different audience-resolution source (project members, not conversation members) |
| Narrative activity log + service | `RoleActivity`/`RoleActivityService`, `TicketActivity`, `EmployeeProfileActivity` — all follow `record(actor, event, title, description, metadata)` | Each feature owns its own activity table by established convention; Orbit's `orbit_work_item_activities` + `OrbitWorkItemActivityService` is the fourth instance of the same pattern, not a shared table |
| Row-locking for a safe incrementing counter | `app/Models/User.php::createToken()`'s `lockForUpdate()` before check-then-write | Different counter (`next_item_number` vs. token-issuance race), same concurrency primitive |
| Content moderation/reporting | `connect_reports` table + `ConnectReportsScreen.tsx` | Deferred to Phase 2+ for Orbit (comments are lower-risk than open chat for v1) — when built, copy this shape rather than inventing a new one |
| Manager/visibility-style scoping service | `app/Services/EmployeeVisibility.php`'s shape (a plain service class with `query()`/`allows()` methods, not a Policy class) | `OrbitAuthorizationService` follows the same "plain service, not a Laravel Policy" convention for consistency with the rest of the codebase |

## Genuinely new primitives (don't exist anywhere in this codebase today)

1. **Drag-and-drop board UI.** Nothing in `client/src/components/ui/` or anywhere else in the web app implements drag-and-drop. Recommend `@dnd-kit/core` (lightweight, accessible, actively maintained, no dependency conflicts with the existing React 18 + Vite setup) for the web board — it's additive, doesn't touch any existing component. Mobile v1 deliberately avoids a drag gesture (see [05](05-information-architecture.md)) so no mobile drag-and-drop library is needed yet.
2. **Fractional/position-based ordering with optimistic-concurrency conflict detection.** No existing feature in this app has an orderable list with concurrent multi-user reordering (Tickets/Approvals are status-workflow-driven, not freely reordered). This is new, but deliberately kept simple — see [07](07-database-design-and-migrations.md) §7 — not a CRDT or external library, just a `decimal` position column and a `version` check.
3. **Many-to-many "link to an existing record" model.** The closest precedent (`ApprovalRequest`'s `approvable_type`/`approvable_id`) is 1:1. `orbit_work_item_links` is a genuinely new shape for this codebase (see [07](07-database-design-and-migrations.md) §5).
4. **Workspace/project-scoped membership roles, layered under org-wide Spatie permissions.** See [06](06-permissions-privacy-tenant-isolation.md) §3 — this is the one real architectural addition Orbit introduces to the permission model, and it's intentionally small (a single `role` enum column on two pivot tables plus one service class) rather than a parallel RBAC system.

## Integration points with existing features (read-only, one-directional)

- **Operations Centre**: the "Create linked Orbit work item" bridge action described in [02](02-operations-centre-vs-orbit-boundary.md) — an `OperationTask` detail view gains one new button; Operations Centre's own code is otherwise untouched.
- **Tickets, Assets, Documents, Leave**: each becomes a valid `linked_type` target for `orbit_work_item_links`. No changes to these features' own models/controllers are required — the link table references them by existing primary key, and access is always re-checked through their own existing endpoints (never through Orbit).
- **Dashboard** (`GET /dashboard/me`): Orbit's "assigned to me" count should appear in the existing pending-items summary, the same way Leave/Tickets/Approvals already contribute to it — a small, additive change to `DashboardService`, not a new dashboard.
- **Connect** (explicitly deferred per the spec, not an MVP dependency): a future Phase 2+ idea is a Connect message that deep-links to an Orbit work item, reusing `mentions`/action-URL patterns already proven in `notificationNavigation.ts`. Not built for MVP.
