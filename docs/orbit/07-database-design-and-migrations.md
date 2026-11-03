# 07 — Database Design & Migration Plan

All tables use `organization_id` (indexed) for tenant scoping, following the existing convention. Primary keys are standard auto-increment integers (matching the rest of the app — e.g. `Ticket`, `Asset`, `OperationTask`), **except** where noted; Connect's `connect_*` tables use UUID PKs (`HasUuids`) because conversations are referenced in URLs/deep-links — Orbit work items also need a stable, shareable reference, but that's solved by the human-readable `key` (`PROJ-124`), so integer PKs are sufficient and simpler.

## 1. Core hierarchy tables

**`orbit_workspaces`**
| Column | Type | Notes |
|---|---|---|
| id | bigint PK | |
| organization_id | bigint FK → organizations | indexed |
| name | string | |
| slug | string | unique per `(organization_id)` |
| description | text, nullable | |
| visibility | string (`private`/`organization`), default `organization` | |
| owner_id | bigint FK → users | creator, mirrors Connect's `owner_id` convention |
| archived_at | timestamp, nullable | |
| created_at / updated_at | timestamp | |

**`orbit_workspace_members`**
| Column | Type | Notes |
|---|---|---|
| id | bigint PK | |
| organization_id | bigint FK | denormalized for fast tenant filtering, matches org on workspace |
| workspace_id | bigint FK → orbit_workspaces | |
| user_id | bigint FK → users | |
| role | string enum: `admin`/`member` | |
| created_at / updated_at | | |
| **unique** | `(workspace_id, user_id)` | |

**`orbit_projects`**
| Column | Type | Notes |
|---|---|---|
| id | bigint PK | |
| organization_id | bigint FK | |
| workspace_id | bigint FK → orbit_workspaces | |
| name | string | |
| key_prefix | string(10) | e.g. `PROJ` — see §6 for generation rule |
| description | text, nullable | |
| mode | string enum: `kanban`/`scrum`/`simple` | set at creation, drives frontend field visibility only |
| visibility | string (`private`/`organization`), default `organization` | |
| next_item_number | unsigned integer, default 1 | incremented transactionally on item creation, see §6 |
| archived_at | timestamp, nullable | |
| created_at / updated_at | | |
| **unique** | `(organization_id, key_prefix)` | project keys must be unique org-wide so `PROJ-124` is unambiguous |

**`orbit_project_members`**
| Column | Type | Notes |
|---|---|---|
| id | bigint PK | |
| organization_id | bigint FK | |
| project_id | bigint FK → orbit_projects | |
| user_id | bigint FK → users | |
| role | string enum: `admin`/`contributor`/`viewer` | see [06](06-permissions-privacy-tenant-isolation.md) §3 |
| created_at / updated_at | | |
| **unique** | `(project_id, user_id)` | |

## 2. Work items

**`orbit_work_items`**
| Column | Type | Notes |
|---|---|---|
| id | bigint PK | |
| organization_id | bigint FK | |
| project_id | bigint FK → orbit_projects | |
| key | string, e.g. `PROJ-124` | **unique** per `organization_id` (not just per project — the prefix already guarantees that, but indexed for fast key lookup) |
| type | string enum: `epic`/`story`/`bug`/`task`/`subtask` | |
| title | string | |
| description | text, nullable | |
| story_template | json, nullable | `{ as_a, i_want, so_that }` — only populated/shown for `type = story` |
| acceptance_criteria | text, nullable | |
| definition_of_done | text, nullable | |
| status_id | bigint FK → orbit_statuses | |
| priority | string enum: `low`/`medium`/`high`/`urgent`, default `medium` | |
| reporter_id | bigint FK → users | |
| assignee_id | bigint FK → users, nullable | |
| parent_id | bigint FK → orbit_work_items, nullable | subtask-of-task / generic hierarchy |
| epic_id | bigint FK → orbit_work_items, nullable | explicit epic link, distinct from `parent_id` per spec |
| iteration_id | bigint FK → orbit_iterations, nullable | null = backlog/unscheduled |
| estimate | decimal(8,2), nullable | story points or hours — unit is a project-level setting, not per-item |
| remaining_estimate | decimal(8,2), nullable | |
| due_at | date, nullable | |
| start_at | date, nullable | |
| position | decimal(20,10) | board/list ordering, see §7 |
| version | unsigned integer, default 1 | optimistic-concurrency token, see §7 |
| started_at / completed_at / archived_at | timestamp, nullable | |
| created_at / updated_at | | |

**`orbit_statuses`** (per-project configurable board columns)
| Column | Type | Notes |
|---|---|---|
| id | bigint PK | |
| project_id | bigint FK → orbit_projects | |
| name | string | e.g. "To Do," "In Review," "Done" |
| category | string enum: `todo`/`in_progress`/`done` | drives default swimlane grouping + whether a status counts as "complete" for metrics, independent of its display name |
| position | unsigned integer | column order |
| is_default | boolean | the status new items land in |

**`orbit_labels`** (per-project, reused on many items)
`id, project_id FK, name, color`, unique `(project_id, name)`.

**`orbit_work_item_labels`** (pivot) — `work_item_id FK, label_id FK`, unique pair.

**`orbit_work_item_watchers`** — `work_item_id FK, user_id FK`, unique pair.

## 3. Iterations (Scrum)

**`orbit_iterations`**
| Column | Type | Notes |
|---|---|---|
| id | bigint PK | |
| project_id | bigint FK → orbit_projects | |
| name | string | e.g. "Sprint 14" |
| goal | text, nullable | |
| starts_at / ends_at | date | |
| capacity_note | string, nullable | free text per spec ("capacity/notes") |
| status | string enum: `planned`/`active`/`completed` | |
| started_at / completed_at | timestamp, nullable | |

**`orbit_iteration_carryovers`** (auditable record of incomplete-work carry-forward, satisfying the spec's "auditable record" requirement without mutating history)
`id, from_iteration_id FK, to_iteration_id FK (nullable — null = back to backlog), work_item_id FK, carried_by_id FK users, created_at`.

A **completed** iteration's own rows (`orbit_iterations.status = 'completed'`) are never edited in place — "prevent accidental changes to completed iteration history" is enforced at the service layer (`OrbitIterationService::close()` is the only writer of `completed_at`; after that, any attempt to re-open or edit the iteration's `starts_at`/`ends_at`/membership is rejected with a 422, mirroring the existing pattern of `ApprovalRequestService::act()` rejecting invalid transitions on an already-terminal `ApprovalRequest`).

## 4. Collaboration

**`orbit_comments`**
| Column | Type | Notes |
|---|---|---|
| id | bigint PK | |
| organization_id | bigint FK | |
| work_item_id | bigint FK → orbit_work_items | |
| author_id | bigint FK → users | |
| body | text | |
| reply_to_id | bigint FK → orbit_comments, nullable | **directly reuses Connect's threaded-reply pattern** (`connect_messages.reply_to_id`) |
| mentions | json, nullable | **directly reuses Connect's mentions pattern** — array of user IDs parsed from `@name` at save time |
| edited_at / deleted_at | timestamp, nullable | soft-delete for comments (recoverable within retention, see [12](12-risks-edge-cases-testing.md)) |
| created_at / updated_at | | |

**`orbit_attachments`** — Orbit owns one attachments table for its own records, following the established convention that each feature owns its own file storage rather than a shared cross-app `Attachment` model (confirmed: Documents, Tickets, Connect, and Assets each have their own file columns/tables — there is no generic `Attachment` model anywhere in this codebase, and Orbit should not be the first to invent one).

| Column | Type | Notes |
|---|---|---|
| id | bigint PK | |
| organization_id | bigint FK | |
| work_item_id | bigint FK, nullable | set if attached directly to a work item |
| comment_id | bigint FK, nullable | set if attached to a comment (exactly one of the two is set) |
| uploaded_by_id | bigint FK → users | |
| file_name | string | |
| file_path | string, **hidden from API responses** | same `$hidden` convention as `ConnectMessage::$hidden = ['file_path']` |
| mime_type | string | |
| file_size | unsigned integer | |
| created_at | timestamp | |

Served through a dedicated `GET /orbit/attachments/{attachment}/file` route using the exact `Storage::disk('local')->path()` + `response()->file()` pattern already used by `EmployeeDocumentController::view()`/`download()` and `ConnectChatController::photo()` — gated by an `authorizeAttachmentAccess()` helper mirroring `EmployeeDocumentController`'s `authorizeDocumentAccess()` (organization match + project-membership check).

**`orbit_work_item_activities`** — narrative audit trail, following the exact repeated pattern already used three times in this codebase (`RoleActivity`, `EmployeeProfileActivity`, `TicketActivity`), each with its own table + `*ActivityService::record()`.

| Column | Type | Notes |
|---|---|---|
| id | bigint PK | |
| organization_id | bigint FK | |
| work_item_id | bigint FK → orbit_work_items | |
| actor_id | bigint FK → users | |
| event | string | e.g. `status_changed`, `assigned`, `moved`, `commented`, `iteration_changed`, `priority_changed` |
| title | string | human-readable, e.g. "Moved from To Do to In Review" |
| from_value / to_value | json, nullable | previous/new state — satisfies the spec's explicit "previous and new state" audit requirement for board movement |
| metadata | json, nullable | |
| created_at | timestamp | |

In addition, `OrbitWorkItem` (and `OrbitWorkspace`, `OrbitProject`) implement `OwenIt\Auditing\Contracts\Auditable` (the same package already used for `Role`, `User`, `Organization`), giving automatic field-level before/after tracking **on top of** the narrative activity log above — matching the existing dual-logging convention (generic auditing package + purpose-built narrative log) rather than picking only one.

## 5. Links to existing Valtireo records

**`orbit_work_item_links`**
| Column | Type | Notes |
|---|---|---|
| id | bigint PK | |
| organization_id | bigint FK | enforced to match both the work item's and the linked record's org at write time |
| work_item_id | bigint FK → orbit_work_items | |
| linked_type | string | morph class, e.g. `App\Models\Ticket`, `App\Models\Asset`, `App\Models\EmployeeDocument`, `App\Models\LeaveRequest`, `App\Models\OperationTask` |
| linked_id | bigint | |
| created_by_id | bigint FK → users | |
| created_at | timestamp | |
| **unique** | `(work_item_id, linked_type, linked_id)` | no duplicate links |
| **index** | `(linked_type, linked_id)` | fast reverse lookup ("what work items link to this ticket") |

This is a genuinely new pattern in the codebase — the closest existing precedent, `ApprovalRequest`'s `approvable_type`/`approvable_id`, is a 1:1 "this approval belongs to one thing" morph; `orbit_work_item_links` is intentionally many-to-many-shaped (a work item can link to several records; a record can be linked from several work items).

## 6. Work-item key generation (`PROJ-124`) — concurrency-safe

`OrbitProject.next_item_number` is incremented transactionally using the **same row-locking pattern already established in this codebase** (`app/Models/User.php::createToken()` locks the employee row with `lockForUpdate()` before a check-then-write to close a race condition):

```php
DB::transaction(function () use ($project, $attributes) {
    $project = OrbitProject::where('id', $project->id)->lockForUpdate()->first();
    $number = $project->next_item_number;
    $project->increment('next_item_number');
    return OrbitWorkItem::create([...$attributes, 'key' => "{$project->key_prefix}-{$number}"]);
});
```

This guarantees no two simultaneous "create work item" requests in the same project can ever produce the same key, without needing a database-level sequence object (keeping it portable across whatever DB engine the app uses — confirmed MySQL-compatible via the existing migrations' column types).

## 7. Ordering strategy for board/list movement, and concurrency for simultaneous edits

**Ordering**: `orbit_work_items.position` is a `decimal(20,10)`. Inserting a card between two existing positions sets it to the midpoint of its new neighbors' `position` values. This is resilient to an essentially unlimited number of reorders without a rebalancing job — decimal midpoint insertion only exhausts precision after an astronomically large number of insertions between the same two neighbors, far beyond realistic board sizes (hundreds, not millions, of cards per column). If a column's positions ever do get too close together to insert cleanly (detected as a midpoint computing to an unchanged value), the server renumbers that column's items synchronously in the same request (an `UPDATE` of at most a few hundred rows) rather than requiring a background job — Orbit's board sizes don't justify async rebalancing infrastructure for v1.

**Concurrency for drag-and-drop and simultaneous edits**: optimistic concurrency via the `version` integer column. Every update request (move, edit, status change) must include the `version` it last read; the server does `UPDATE ... WHERE id = ? AND version = ?` and increments `version` on success. A mismatch returns `409 Conflict` with the current server state, and the client re-fetches and prompts the user to retry — this is the same class of "detect, don't silently overwrite" strategy, scaled down from what a full operational-transform/CRDT system would do, appropriate for Orbit's MVP concurrency needs (a handful of people editing one board, not hundreds).

## 8. Soft-delete / archive decisions

- **Archive** (`archived_at` on workspaces/projects/work items) is a **business-state** hide: the record is fully intact, excluded from default list views, but still linkable, still visible in its own detail view, still shows up in reports if explicitly included. Nothing is destroyed.
- **Soft-delete** (`deleted_at`, Eloquent `SoftDeletes` trait) is reserved for comments and attachments only (accidental-delete recovery within a retention window — see [12](12-risks-edge-cases-testing.md) for the retention/purge job). Workspaces/projects/work items are **never hard- or soft-deleted** by a regular user — only archived. A true destructive delete of a workspace/project (e.g. for GDPR/legal erasure) is an org-admin-only, confirmation-gated action out of scope for MVP, deferred alongside the rest of the app's data-retention story (no existing feature in this app has a "permanently erase" flow either, confirmed in research — this isn't a gap unique to Orbit).

## 9. Migration order

1. `create_orbit_workspaces_table` + `create_orbit_workspace_members_table`
2. `create_orbit_projects_table` (FK → workspaces) + `create_orbit_project_members_table`
3. `create_orbit_statuses_table` (FK → projects)
4. `create_orbit_iterations_table` (FK → projects)
5. `create_orbit_work_items_table` (FK → projects, statuses, iterations, and self-referencing `parent_id`/`epic_id` — self-FKs added via a second `alter` migration, matching Laravel convention for self-referencing FKs on the same table as their creation)
6. `create_orbit_labels_table` + `create_orbit_work_item_labels_table` + `create_orbit_work_item_watchers_table`
7. `create_orbit_comments_table` (self-referencing `reply_to_id` via the same two-step pattern as #5)
8. `create_orbit_attachments_table`
9. `create_orbit_work_item_activities_table`
10. `create_orbit_work_item_links_table`
11. `create_orbit_iteration_carryovers_table`
12. `grant_orbit_permissions` (seeds the `orbit.*` permission strings into the `permissions` table — matching the existing `2026_09_24_010001_grant_operations_center_permissions.php` precedent exactly) + insert the `orbit` row into `platform_modules`
