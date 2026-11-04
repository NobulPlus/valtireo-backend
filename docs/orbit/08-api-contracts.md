# 08 — API Contract Proposal

All routes are registered under `Route::prefix('orbit')->middleware(EnsureModuleIsSubscribed::class.':orbit')` in `server/routes/api.php`, matching the exact existing pattern used for Connect's `Route::prefix('connect')->middleware(EnsureModuleIsSubscribed::class.':connect')`. Every handler additionally checks the relevant `orbit.*` permission and/or workspace/project membership role per [06](06-permissions-privacy-tenant-isolation.md).

## Workspaces

```
GET    /orbit/workspaces                      list workspaces visible to the user
POST   /orbit/workspaces                      create (requires orbit.workspaces.create)
GET    /orbit/workspaces/{workspace}          show (404 if not visible/member, per visibility rules)
PATCH  /orbit/workspaces/{workspace}          update (requires workspace admin role or orbit.workspaces.administer)
POST   /orbit/workspaces/{workspace}/archive
POST   /orbit/workspaces/{workspace}/restore
GET    /orbit/workspaces/{workspace}/members
POST   /orbit/workspaces/{workspace}/members          { user_id, role }
PATCH  /orbit/workspaces/{workspace}/members/{user}   { role }
DELETE /orbit/workspaces/{workspace}/members/{user}
```

**POST `/orbit/workspaces` request**
```json
{ "name": "Product & Engineering", "description": "...", "visibility": "organization" }
```
**Response `201`**
```json
{ "workspace": { "id": 12, "name": "Product & Engineering", "slug": "product-engineering",
  "visibility": "organization", "owner_id": 44, "member_count": 1, "project_count": 0,
  "created_at": "2026-11-01T10:00:00Z" } }
```

## Projects

```
GET    /orbit/workspaces/{workspace}/projects
POST   /orbit/workspaces/{workspace}/projects          { name, key_prefix, mode, visibility }
GET    /orbit/projects/{project}                        overview: counts, recent activity, risks (overdue items)
PATCH  /orbit/projects/{project}
POST   /orbit/projects/{project}/archive
GET    /orbit/projects/{project}/members
POST   /orbit/projects/{project}/members                { user_id, role }
PATCH  /orbit/projects/{project}/members/{user}         { role }
DELETE /orbit/projects/{project}/members/{user}
GET    /orbit/projects/{project}/statuses               board column config
POST   /orbit/projects/{project}/statuses                { name, category, position }
PATCH  /orbit/projects/{project}/statuses/{status}
DELETE /orbit/projects/{project}/statuses/{status}       blocked (422) if any work item currently uses it
```

**POST `/orbit/workspaces/{workspace}/projects` request**
```json
{ "name": "Mobile App Redesign", "key_prefix": "MOBI", "mode": "scrum", "visibility": "organization" }
```
`422` if `key_prefix` is not unique within the organization (checked case-insensitively).

## Work items

```
GET    /orbit/projects/{project}/work-items             ?status_id=&assignee_id=&type=&label_id=&epic_id=&iteration_id=&due_before=
POST   /orbit/projects/{project}/work-items
GET    /orbit/work-items/{workItem:key}                  look up by human key, e.g. /orbit/work-items/MOBI-124
PATCH  /orbit/work-items/{workItem:key}                  requires `version` for optimistic concurrency
POST   /orbit/work-items/{workItem:key}/move             { status_id, position, version }
POST   /orbit/work-items/{workItem:key}/archive
POST   /orbit/work-items/{workItem:key}/watch
DELETE /orbit/work-items/{workItem:key}/watch
```

**POST `/orbit/projects/{project}/work-items` request** (story example)
```json
{
  "type": "story", "title": "Redesign onboarding flow",
  "epic_id": 501,
  "story_template": { "as_a": "new employee", "i_want": "a guided first-week checklist",
                       "so_that": "I know what's expected without asking my manager" },
  "acceptance_criteria": "Checklist renders on first login; each item marks complete; manager sees progress.",
  "assignee_id": 77, "priority": "high", "estimate": 5, "label_ids": [3, 9], "due_at": "2026-11-20"
}
```
**Response `201`**
```json
{ "work_item": { "id": 9021, "key": "MOBI-124", "type": "story", "title": "Redesign onboarding flow",
  "status": { "id": 2, "name": "To Do", "category": "todo" }, "priority": "high",
  "reporter": { "id": 44, "name": "Chidi Okafor" }, "assignee": { "id": 77, "name": "Amaka Obi" },
  "epic": { "id": 501, "key": "MOBI-100", "title": "Onboarding revamp" },
  "labels": [{ "id": 3, "name": "ux" }], "estimate": 5, "remaining_estimate": 5,
  "due_at": "2026-11-20", "version": 1, "created_at": "2026-11-01T10:05:00Z" } }
```

**PATCH `/orbit/work-items/{key}` with stale version → `409`**
```json
{ "message": "This work item was changed by someone else. Refresh and try again.",
  "current": { "version": 4, "updated_at": "2026-11-01T10:12:03Z", "updated_by": { "id": 12, "name": "..." } } }
```

**POST `/orbit/work-items/{key}/move` request**
```json
{ "status_id": 3, "position": "12.5000000000", "version": 3 }
```
Server records an `orbit_work_item_activities` row with `event: "moved"`, `from_value: {"status_id": 2}`, `to_value: {"status_id": 3}`.

## Comments

```
GET    /orbit/work-items/{workItem:key}/comments
POST   /orbit/work-items/{workItem:key}/comments        { body, reply_to_id? }
PATCH  /orbit/comments/{comment}                         author only, within an edit window (mirrors Connect's 15-minute delete-window precedent, applied here as an edit window)
DELETE /orbit/comments/{comment}                         author or project admin
```

**POST comment request**
```json
{ "body": "Already in the drive, I'll attach it — @Tunde can you confirm?", "reply_to_id": null }
```
Server parses `@Name` mentions into `mentions: [userId]` at save time (same parsing approach as Connect's composer), triggers an assignment-style notification to each mentioned user who has access to the work item (mentioning someone without project access is silently dropped, mirroring Connect's `direct`-conversation mention-drop precedent — mentioning someone who can't see the item would otherwise leak its existence).

## Attachments

```
POST   /orbit/work-items/{workItem:key}/attachments      multipart/form-data
POST   /orbit/comments/{comment}/attachments             multipart/form-data
GET    /orbit/attachments/{attachment}/file               streamed, same pattern as GET /documents/{id}/download
DELETE /orbit/attachments/{attachment}
```

## Backlog & iterations (Scrum-mode projects only — `404` if `project.mode !== 'scrum'`)

```
GET    /orbit/projects/{project}/backlog                 unscheduled work items, ordered by position
POST   /orbit/projects/{project}/backlog/reorder          { work_item_id, position }
GET    /orbit/projects/{project}/iterations
POST   /orbit/projects/{project}/iterations               { name, goal, starts_at, ends_at, capacity_note }
GET    /orbit/iterations/{iteration}                       includes planned/completed/incomplete counts, estimate totals, scope-change count
POST   /orbit/iterations/{iteration}/start
POST   /orbit/iterations/{iteration}/complete              { carry_to: "next_iteration" | "backlog", target_iteration_id? }
PATCH  /orbit/iterations/{iteration}/items                 { add: [workItemId...], remove: [workItemId...] }
```

**POST `/orbit/iterations/{iteration}/complete` response**
```json
{ "iteration": { "id": 14, "status": "completed", "completed_at": "2026-11-15T17:00:00Z" },
  "summary": { "planned": 12, "completed": 9, "incomplete": 3, "estimate_total": 46, "estimate_completed": 34, "scope_added_during_sprint": 2 },
  "carried_over": [ { "work_item_id": 9021, "to": "next_iteration", "to_iteration_id": 15 } ] }
```

## Links to existing Valtireo records

```
GET    /orbit/work-items/{workItem:key}/links
POST   /orbit/work-items/{workItem:key}/links            { linked_type: "ticket"|"asset"|"document"|"leave_request"|"operation_task", linked_id }
DELETE /orbit/work-item-links/{link}
```

**GET links response** — note: metadata only, per [06](06-permissions-privacy-tenant-isolation.md) §7; the linked record's own detail is never embedded:
```json
{ "links": [
  { "id": 61, "linked_type": "ticket", "linked_id": 318,
    "label": "TCK-318 — Login button misaligned on iPad", "url": "/tickets/318",
    "viewer_can_access": true },
  { "id": 62, "linked_type": "document", "linked_id": 44,
    "label": null, "url": null, "viewer_can_access": false }
] }
```
When `viewer_can_access: false`, the frontend renders "Linked record unavailable" rather than any label — the server withholds the label itself, not just the link, for records the viewer can't see, so no information about the linked record leaks through the label text either.

## My Work

```
GET /orbit/my-work?filter=assigned|mentioned|watched|overdue|due_soon
```
Response shape matches the existing dashboard aggregation convention (`GET /dashboard/me`) — a flat list of work-item summaries with `project`, `workspace`, `status`, `due_at`, and `reason` (why it's in this list: `assigned`/`mentioned`/`watching`/`overdue`/`due_soon`).

## Reporting (basic, MVP-level only)

```
GET /orbit/projects/{project}/activity                   paginated, same shape as GET /activity-feed filtered to this project
GET /orbit/iterations/{iteration}/report                 the same summary object shown in iteration-complete, available anytime mid-sprint
```

## Admin

```
GET /orbit/admin/workspaces                               org-wide list, requires orbit.admin.manage
GET /orbit/admin/archived                                  archived workspaces/projects/items across the org
```

## Error contract

All Orbit endpoints follow the existing app-wide error shape (confirmed via `client/src/lib/apiClient.ts`'s `ApiError` normalization): `401` for unauthenticated, `403` with a human-readable `message` for module-not-subscribed or permission-denied (e.g. `"Your organization is not subscribed to the Orbit module."` — identical wording pattern to the existing `EnsureModuleIsSubscribed` message), `404` for not-found-or-not-visible (deliberately indistinguishable from "doesn't exist," per [06](06-permissions-privacy-tenant-isolation.md) §7), `409` for optimistic-concurrency conflicts (§ above), `422` for validation errors in Laravel's standard `{ "message": "...", "errors": {...} }` shape.
