# 05 — Information Architecture (Web & Mobile)

## Web

### Navigation entry

Orbit is a new top-level item in `client/src/components/shell/navConfig.ts`'s `NAV_GROUPS` array — most naturally under the existing `Core` group (alongside Dashboard, Calendar, Connect, Operations centre), since Orbit is a daily-use tool, not an admin-only or employee-self-service-only feature like the `My workspace`/`Governance` groups. Its `NavItem` sets `moduleKey: 'orbit'` and `permission: 'orbit.access'` — exactly the two-axis gate every other module item already uses (`moduleByKey(item.moduleKey)?.visibility === 'enabled'` AND `hasPermission(item.permission)`), so no new gating mechanism is needed in `Sidebar.tsx`.

### Route structure (new feature folder `client/src/features/orbit/`, lazy-loaded from `App.tsx` via the existing `namedLazy()` helper, nested under the existing `<ProtectedRoute><AppShell/></ProtectedRoute>` wrapper)

```
/orbit                                    → My Work (default landing)
/orbit/workspaces                         → Workspace list (create/switch)
/orbit/workspaces/:workspaceId            → Workspace overview
/orbit/workspaces/:workspaceId/projects/:projectId            → Project overview
/orbit/workspaces/:workspaceId/projects/:projectId/board      → Board
/orbit/workspaces/:workspaceId/projects/:projectId/backlog    → Backlog (scrum mode only)
/orbit/workspaces/:workspaceId/projects/:projectId/iterations/:iterationId  → Iteration planning
/orbit/workspaces/:workspaceId/projects/:projectId/items/:itemKey          → Work item detail
/orbit/workspaces/:workspaceId/projects/:projectId/activity   → Project activity
/orbit/workspaces/:workspaceId/projects/:projectId/settings   → Project settings (columns, labels, mode)
/orbit/admin                              → Workspace/module-level admin (org-scope list, archived items)
```

Each route-level page lives in its own file inside `client/src/features/orbit/` (flat, matching the existing convention — e.g. `features/leave/MyLeavePage.tsx` sits directly in the feature folder, not in a nested `pages/` subfolder). A direct URL hit on a route the user lacks permission for renders the existing `RequirePermission` wrapper's `<ForbiddenState/>`, exactly as every other protected route does today.

### Data fetching

`client/src/features/orbit/api.ts` (and submodule files `boardApi.ts`, `backlogApi.ts`, `workItemApi.ts` if the single file grows too large) follow the exact shape confirmed in `client/src/features/leave/api.ts`: query keys as plain feature-first arrays (`['orbit', 'workspaces']`, `['orbit', 'projects', projectId, 'board']`, `['orbit', 'items', itemKey]`), calling the shared `api.get/post/patch/put/delete` wrapper from `client/src/lib/apiClient.ts`, hook names `useWorkspaces`, `useProject`, `useBoard`, `useCreateWorkItem`, `useMoveWorkItem`, etc. Mutations invalidate the exact affected keys plus, where relevant, `['dashboard', 'me']` (so a newly-assigned work item shows up in the dashboard's pending-items summary the same way a new leave request does today).

### Design system

Reuses `client/src/components/ui/*` as-is — `DataTable` for the backlog table, `StatusBadge`/`PriorityBadge` for work item status/priority chips (these two components already exist precisely for this shape of data), `Modal`/`ModalActions` for the work-item detail/create flows, `Dropdown`/`SelectMenu` for assignee/label pickers, `Pagination` for long lists, `PageHeader` for each screen's header. No new design-system components are required for MVP. Board-column drag-and-drop is the one genuinely new UI primitive (no existing drag-and-drop anywhere in the app) — see [09](09-reusable-components-and-integration-points.md) for the library recommendation.

## Mobile

### Navigation entry

Orbit does **not** get its own bottom tab. Per the confirmed existing convention — a hidden `tabBarButton` still reserves its flex slot and leaves a visible gap, so modules below a certain usage frequency are placed inside `MoreTab`'s menu instead of getting a dedicated tab (Assets, Payslips, Documents, Lifestyle, Connect, Calendar, Directory all do this today via `mobile/src/lib/moreMenuItems.ts`) — Orbit's "My Work" surfaces as a new row in that same `MoreTab` menu for v1. Orbit's `Tab.Screen` registration (if the org isn't subscribed, or the user lacks `orbit.access`) must be **conditionally omitted entirely** (`{showOrbit ? <Tab.Screen .../> : null}`), not hidden-but-rendered — reusing the exact pattern `MainTabs.tsx` already uses for `LeaveTab`/`AttendanceTab`/`TicketsTab`.

If usage data after MVP shows Orbit is a daily-frequency tool for a meaningful share of mobile users, promoting it to a dedicated tab is a cheap Phase 2+ change (it's a navigation config change, not a data-model change) — but starting inside `MoreTab` is the conservative, consistent-with-precedent choice for v1.

### Screens (new `mobile/src/navigation/OrbitStack.tsx`, new screens under `mobile/src/screens/`)

```
OrbitMyWorkScreen       — assigned to me / mentioned / watched / overdue / due soon (tabs within one screen)
OrbitWorkspaceListScreen — read-only list of workspaces the user belongs to
OrbitProjectListScreen  — projects within a workspace
OrbitBoardScreen        — read-mostly board view: columns, cards, tap to open detail, tap-and-hold to change status (no drag-and-drop on mobile v1 — status change via a picker, not a gesture)
OrbitWorkItemDetailScreen — full detail: description, comments (post a comment), status change, attachments (view/add), watchers
OrbitNewItemScreen      — create a basic task/bug, gated by project-membership write permission
```

Explicitly **not** built for mobile v1: workspace/project administration, column/workflow configuration, backlog grooming, iteration planning/start/close. This mirrors the spec's own instruction and the existing precedent that Operations Centre, Role management, and Audit log have no mobile screen at all — administration stays web-first unless a strong case emerges later.

### Data fetching & push

`mobile/src/features/orbit/api.ts` mirrors the web `api.ts` query-key shape exactly (same convention already followed by every other mobile feature). List screens (My Work, Board, Backlog-adjacent views if ever added to mobile) use the existing shared `mobile/src/lib/useInfiniteList.ts` pagination helper, matching how Leave/Tickets/Assets already paginate on mobile. File attachments on mobile use the existing `RNFile { uri, name, type }` upload shape, not a new one.

Push notifications for Orbit (assignment, mention, comment, due date) reuse `ExpoPushChannel`/`device_push_tokens` end-to-end — no new push infrastructure. Deep-linking on tap extends `mobile/src/lib/notificationNavigation.ts::resolveNotificationDestination()`'s existing allowlist switch with new destination kinds (`orbitWorkItemDetail`, `orbitMyWork`), following the exact pattern already used for `ticketDetail`/`approvalDetail`/`connectConversation`.
