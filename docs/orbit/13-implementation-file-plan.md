# 13 — Exact Implementation Files Expected, Per Phase

This is a planning reference — **no files listed here have been created.** Paths follow the existing codebase's exact conventions confirmed in this research pass.

## Phase 1 (MVP)

### Backend — migrations (`server/database/migrations/`)
```
2026_11_xx_000000_create_orbit_workspaces_table.php
2026_11_xx_000001_create_orbit_workspace_members_table.php
2026_11_xx_000002_create_orbit_projects_table.php
2026_11_xx_000003_create_orbit_project_members_table.php
2026_11_xx_000004_create_orbit_statuses_table.php
2026_11_xx_000005_create_orbit_iterations_table.php
2026_11_xx_000006_create_orbit_work_items_table.php
2026_11_xx_000007_add_self_referencing_fks_to_orbit_work_items_table.php
2026_11_xx_000008_create_orbit_labels_table.php
2026_11_xx_000009_create_orbit_work_item_labels_table.php
2026_11_xx_000010_create_orbit_work_item_watchers_table.php
2026_11_xx_000011_create_orbit_comments_table.php
2026_11_xx_000012_add_reply_to_fk_to_orbit_comments_table.php
2026_11_xx_000013_create_orbit_attachments_table.php
2026_11_xx_000014_create_orbit_work_item_activities_table.php
2026_11_xx_000015_create_orbit_work_item_links_table.php
2026_11_xx_000016_create_orbit_iteration_carryovers_table.php
2026_11_xx_000017_grant_orbit_permissions.php
2026_11_xx_000018_register_orbit_platform_module.php
```

### Backend — models (`server/app/Models/`)
```
OrbitWorkspace.php, OrbitWorkspaceMember.php, OrbitProject.php, OrbitProjectMember.php,
OrbitStatus.php, OrbitIteration.php, OrbitIterationCarryover.php, OrbitWorkItem.php,
OrbitLabel.php, OrbitComment.php, OrbitAttachment.php, OrbitWorkItemActivity.php,
OrbitWorkItemLink.php
```
Plus a shared `app/Models/Concerns/BelongsToOrganization.php` trait (see [06](06-permissions-privacy-tenant-isolation.md) §1) — the one piece of this plan that's reusable beyond Orbit, deliberately scoped as a trait rather than modifying any existing model.

### Backend — services (`server/app/Services/`)
```
OrbitAuthorizationService.php      — membership-role resolution, mirrors EmployeeVisibility's shape
OrbitWorkItemKeyGenerator.php      — the lockForUpdate() counter logic
OrbitBoardOrderingService.php      — position midpoint insertion + synchronous renumber
OrbitWorkItemActivityService.php   — record(), fourth instance of the RoleActivity/TicketActivity pattern
OrbitNotificationService.php       — thin wrapper adding Orbit's methods to NotificationDispatchService's existing call sites, OR new methods added directly onto NotificationDispatchService.php (either is consistent; direct addition matches how Ticket/Document/Approval notifications are already organized in one file)
```

### Backend — controllers (`server/app/Http/Controllers/Api/`)
```
OrbitWorkspaceController.php, OrbitProjectController.php, OrbitStatusController.php,
OrbitWorkItemController.php, OrbitCommentController.php, OrbitAttachmentController.php,
OrbitWorkItemLinkController.php, OrbitMyWorkController.php
```

### Backend — form requests (`server/app/Http/Requests/Orbit/`)
```
StoreWorkspaceRequest.php, UpdateWorkspaceRequest.php, StoreProjectRequest.php,
StoreWorkItemRequest.php, UpdateWorkItemRequest.php, MoveWorkItemRequest.php,
StoreCommentRequest.php, StoreWorkItemLinkRequest.php
```

### Backend — routes
Addition to `server/routes/api.php`, following the exact `Route::prefix('connect')->middleware(...)` block shape.

### Frontend (web) — `client/src/features/orbit/`
```
api.ts                      — workspace/project/work-item/comment/link hooks, react-query, matches leave/api.ts shape
MyWorkPage.tsx
WorkspaceListPage.tsx
WorkspaceOverviewPage.tsx
ProjectOverviewPage.tsx
BoardPage.tsx                — @dnd-kit/core board
WorkItemDetailModal.tsx       — or a routed detail page, consistent with existing TicketDetailModal.tsx precedent
ProjectSettingsPage.tsx       — status/label/mode config
OrbitAdminPage.tsx
components/                  — WorkItemCard.tsx, StatusColumn.tsx, LinkPicker.tsx, CommentThread.tsx (Orbit-local; everything else reuses client/src/components/ui/*)
```
Plus: a new `orbit` entry in `client/src/components/shell/navConfig.ts`'s `NAV_GROUPS`, and new lazy route registrations in `client/src/App.tsx`.

### Frontend (mobile) — `mobile/src/`
```
features/orbit/api.ts
screens/OrbitMyWorkScreen.tsx
screens/OrbitWorkspaceListScreen.tsx
screens/OrbitProjectListScreen.tsx
screens/OrbitBoardScreen.tsx
screens/OrbitWorkItemDetailScreen.tsx
screens/OrbitNewItemScreen.tsx
navigation/OrbitStack.tsx
```
Plus: a new row in `mobile/src/lib/moreMenuItems.ts`, and two new destination kinds added to `mobile/src/lib/notificationNavigation.ts`.

### Tests
See [12](12-risks-edge-cases-testing.md) for the full list of `server/tests/Feature/Orbit/*.php` files.

## Phase 2 additions

Backend: `orbit_backlog`/`orbit_iterations` controllers and endpoints activated (tables already exist from Phase 1); `OrbitIterationService.php` (start/complete/carry-forward logic). Frontend web: `BacklogPage.tsx`, `IterationPlanningPage.tsx`. Operations Centre: one new button + endpoint (`POST /operations/tasks/{task}/create-linked-work-item`) on the existing `OperationsCenterController`.

## Phase 3 additions

`orbit_project_templates` table + `OrbitProjectTemplateController.php`; `orbit_work_item_dependencies` table; `ProjectActivityDashboardPage.tsx` using existing `Charts.tsx`/`StatTile.tsx`.

## Phase 4 additions

Not file-planned here — gated on separate product approval and (for external guests) a dedicated security design pass, per [11](11-mvp-and-phase-plan.md).
