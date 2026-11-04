# 06 — Permissions, Privacy & Tenant Isolation

## 1. Tenant isolation — the real convention, and a deliberate improvement for Orbit

Confirmed: there is **no Eloquent global scope** anywhere in this codebase that automatically restricts queries to `organization_id`. Every controller manually adds `->where('organization_id', $request->user()->organization_id)` or `abort_unless($model->organization_id === $request->user()->organization_id, 404)`. This is a real, demonstrated risk — it is exactly the bug class fixed in commit `cd5b14a` ("My Assets leaked the whole org's asset list to privileged viewers").

**Recommendation for Orbit**: introduce a `BelongsToOrganization` trait (a small `booted()` global scope that adds `where('organization_id', ...)` automatically, resolving the current organization the same way `SetPermissionsTeamId` resolves it) and apply it to all five new Orbit models (`OrbitWorkspace`, `OrbitProject`, `OrbitWorkItem`, `OrbitComment`, `OrbitAttachment`). This is additive — it does not touch any existing model — and gives Orbit a structural safety net the rest of the app doesn't have, without requiring a big-bang refactor. Every write path still explicitly checks `organization_id` too (defense in depth, matching existing controller style), but a forgotten `where()` clause in a new Orbit controller can no longer leak data cross-tenant by accident.

## 2. Module gate (coarse-grained, org-wide)

`platform_modules` gets a new row: `key = 'orbit'`, `category = 'work'`, `required_permission = 'orbit.access'`. `EnsureModuleIsSubscribed::class . ':orbit'` wraps every Orbit route, exactly like Connect's `EnsureModuleIsSubscribed::class . ':connect'` does today. `ModuleEntitlementService::organizationHasActiveSubscription($org, 'orbit')` must return true (subscription `status` in `active`/`trial`, within `starts_at`/`expires_at`) **and** the acting user must hold `orbit.access` — both checks, same as every existing module.

## 3. Why Orbit needs a membership-role layer that Spatie permissions alone can't give it

Spatie's teams feature scopes permissions to `organization_id` (confirmed: `config/permission.php`'s `team_foreign_key => 'organization_id'`) — it has **no concept of scoping a role to one workspace or project within an organization**. Today's closest precedent, Connect's `owner_id` on a conversation, is single-owner and binary (owner or not) — it doesn't generalize to "Project Administrator in Workspace A, merely a Viewer in Workspace B," which the spec explicitly requires.

So Orbit introduces one new, small concept: a `role` column directly on the membership pivot tables (`orbit_workspace_members.role`, `orbit_project_members.role` — enum `admin`/`member`/`contributor`/`viewer`, see [07](07-database-design-and-migrations.md) §1). This is deliberately **not** a new Spatie-style roles table — it's a plain enum column, checked via a dedicated service class (`OrbitAuthorizationService`, mirroring the existing `EmployeeVisibility`/`RoleManagementService` pattern of a plain service with boolean-returning methods, called inline from controllers via `abort_unless(...)` — consistent with this codebase's existing style over introducing Laravel Policy classes, which aren't used anywhere else in the app).

### Permission model (two layers, both required where noted)

**Layer 1 — org-wide Spatie permissions** (seeded permission strings, following the existing `resource.action` convention):

| Permission | Grants |
|---|---|
| `orbit.access` | Module gate — can use Orbit at all |
| `orbit.workspaces.create` | Can create a new workspace |
| `orbit.workspaces.administer` | Can administer *any* workspace in the org (an "Orbit Administrator" escape hatch — see §8) |
| `orbit.projects.create` | Can create a project inside a workspace they belong to |
| `orbit.reports.view_all` | Can view reporting across workspaces/projects they aren't a member of |
| `orbit.admin.manage` | Platform/org-level Orbit admin screen (archived items across workspaces, module-wide settings) |

**Layer 2 — workspace/project membership role** (the new enum column, resolved per-record):

| Membership role | Scope | Can do |
|---|---|---|
| Workspace Administrator | One workspace | Create/archive projects in it, manage workspace membership, set workspace visibility |
| Project Administrator | One project | Configure board columns/workflow, manage project membership, manage iterations, archive the project |
| Project Member / Contributor | One project | Create/edit/move work items, comment, attach files, manage their own watches |
| Viewer | One project | Read-only: view board/backlog/items/comments, cannot create or move |

A request handler checks **both layers** where relevant: e.g. moving a card requires `orbit.access` (module gate) **and** a `orbit_project_members` row for that project with `role` in `['admin', 'contributor']` (or the org-wide `orbit.workspaces.administer` escape hatch). `OrbitAuthorizationService::canEditWorkItem(User $user, OrbitProject $project): bool` encapsulates this union so controllers never duplicate the logic.

### Workspace-admin override vs. project membership — resolved explicitly

Two related questions that must not be left implicit: **what does a Workspace Administrator's authority reach**, and **is a user ever a project member without someone explicitly adding them?**

- A **Workspace Administrator** can administer (configure, archive, manage membership of) **every project inside their workspace** without needing their own `orbit_project_members` row for each one — this is checked as an override inside `OrbitAuthorizationService` (workspace-admin role on the parent workspace satisfies any project-level admin check), not by silently inserting a membership row on their behalf.
- That override is **administrative reach only** — it does not add the Workspace Administrator to a project's member list, does not make them assignable, and does not surface the project in their My Work unless they are separately, explicitly added as a project member. Administering and participating are kept distinct.
- **Project membership is always explicit, with exactly one exception** (the override above): creating a project inserts exactly one `orbit_project_members` row — the creator, as Project Administrator. No other user is ever added to a project by inference from workspace membership, department, or any other structural relationship. Adding a contributor or viewer is always a deliberate action by someone with admin reach over that project.
- **Who can create a project**: any workspace member (any role) who also holds the org-wide `orbit.projects.create` permission, plus any Workspace Administrator of that workspace regardless of whether they separately hold that permission (administering a workspace necessarily includes being able to populate it). A user who is not a member of the workspace at all cannot create a project inside it, even with `orbit.projects.create`, unless they are also an org-wide Orbit Administrator (`orbit.workspaces.administer`).

### Default roles — corrected to match the actual existing convention

Checked against the real codebase rather than assumed: `organization_admin`'s "all permissions" grant isn't computed dynamically — it's `$all = RolePermissionSeeder::permissions()`, a static list, applied once at role-creation time only (`DefaultRoleSeedingService` syncs permissions onto a role solely when `$role->wasRecentlyCreated`, never on a re-run). Every existing module's permissions (`operations.*`, `leave_requests.*`, etc.) are already in that static list, so Organization Admin already receives every module's permissions automatically for any newly-created organization — module subscription, not role permission, is the real gate everywhere else in this app. Orbit follows that exact precedent rather than inventing a stricter rule for itself: `orbit.*` is added to `RolePermissionSeeder::permissions()`, so a **newly-created** organization's Organization Admin gets it automatically, like every other permission. For **organizations that already exist** at the time Orbit ships, a one-time migration grants `orbit.*` to their `organization_admin` role only (mirroring exactly how `grant_operations_center_permissions.php` retroactively granted `operations.*` — except scoped to Organization Admin alone, not the seven other roles that migration also touched, since none of them get blanket access to new modules by convention).

No other default role (`hr_director`, `hr_officer`, `payroll_admin`, `compliance_officer`, `ict_admin`, `department_head`, `supervisor`, `employee`) gets any `orbit.*` permission automatically, for new or existing organizations — granting it to any of them remains a deliberate, separate action through the existing custom-role permission picker. And critically, holding the permission is not the same as being able to use Orbit: the organization must still separately **subscribe to the Orbit module** (`organization_modules`) before anyone — including an Organization Admin who already holds every `orbit.*` permission — can reach a single Orbit route. Adding Orbit to the platform catalog does not auto-subscribe any organization to it, matching how every other module in this app is rolled out. This is where the real "deliberate opt-in" character lives, not in withholding the permission from Organization Admin.

## 4. Cross-organization leakage — concrete checks

- **Membership cannot cross organizations**: `orbit_workspace_members.user_id` and `orbit_project_members.user_id` are validated against `$actor->organization_id` at write time — a user from Org B can never be added to Org A's workspace, even by an Org A admin who mistypes an ID (the lookup itself is scoped: `User::where('organization_id', $org->id)->findOrFail($id)`).
- **Assignment is organization-scoped**: assigning a work item only offers users within the same organization — the assignee picker's API query is scoped identically to the membership picker.
- **Links to other Valtireo records are organization-scoped**: `orbit_work_item_links.linked_type`/`linked_id` is validated at creation time to belong to the same `organization_id` as the work item (checked per-model, same way `EmployeeController`'s cross-tenant checks work today) — a work item in Org A can never link to a ticket in Org B.

## 5. Visibility — workspace/project privacy, and why it doesn't leak membership

`orbit_workspaces.visibility` (`private`/`organization`) and `orbit_projects.visibility` (`private`/`organization`) control **discoverability**, not membership. An `organization`-visible project is listable/readable by anyone in the org with `orbit.access` (read-only unless they're also a project member with write role); a `private` project is invisible to non-members entirely — it doesn't even appear in search/list results for non-members, matching the existing pattern that `RequirePermission`'s forbidden state is the *fallback* for direct URL access, while list/search endpoints filter non-visible records out at the query level (never relying on the frontend to hide them).

**Visibility changes must not preserve stale access**: if a Workspace Administrator flips a project from `organization` to `private`, every non-member immediately loses read access on the next request — there is no grandfather clause. This is enforced server-side in the same query that currently filters by visibility; there's nothing to "revoke" because access was never cached client-side beyond the current page load.

**The binary is deliberate, not provisional.** A third state — "visible/discoverable, but not readable until membership is granted" — was considered and rejected: it would let someone see that a project exists without ever being able to evaluate its content, name, or purpose well enough to decide whether to request access, which makes discovery self-defeating. So `organization` visibility means both discoverable *and* readable (content, not just existence) to any org member with `orbit.access`; writing to it still requires a project-membership role. `private` means neither discoverable nor readable to non-members — it does not appear in list/search results for them at all. There is no middle state in v1.

## 6. Archived/offboarded users lose access immediately

Reuses the exact mechanism already enforced per-request for the whole app: `EnsureOrganizationIsActive` middleware checks `Employee::status` on every request and revokes all Sanctum tokens the moment an employee's status becomes `suspended`/`exited`. Orbit adds nothing new here — a user who loses access to the platform loses access to Orbit for the same reason, on the same request cycle, automatically. Separately, `orbit_project_members`/`orbit_workspace_members` rows for an exited employee are **not deleted** (preserving historical attribution — "who was on this project" stays true to history), but the membership check always re-verifies the user's *current* account status before granting any write action, so a stale membership row never grants access to someone who has lost platform access.

## 7. Linked records — never granting access through a link

This is the spec's sharpest requirement and gets a hard rule: **seeing a work-item link must never grant access to the linked record.** Concretely: `GET /orbit/work-items/{key}` returns link *metadata only* (linked record's type, a short label if the viewer can see it, and its own URL) — it never embeds the linked record's actual data in the work item's own response. The linked record is always fetched through its own existing, independently-authorized endpoint (e.g. `GET /tickets/{id}`), which re-runs that feature's own permission checks every time. If the viewer lacks permission for the linked ticket, ticket, or document, the frontend renders "Linked record unavailable" (reusing the existing `ForbiddenState`/`ErrorState` components from `client/src/components/ui/States.tsx` and the mobile `QueryError` component's 403 branch) — it never falls back to showing a cached label or partial data, and it never throws an unhandled error that could leak existence/non-existence information inconsistently between "doesn't exist" and "exists but forbidden" (both render the same safe fallback).

## 8. Organization administrators do not bypass linked-record permissions

Holding `orbit.workspaces.administer` or even `organizations.administer` governs **Orbit's own records** (workspaces, projects, work items) — it does **not** extend to the records a work item merely links to. An org admin who is Workspace Administrator of every Orbit workspace still needs `payroll.compensation.view` in its own right to see the payroll exception a work item links to; Orbit's administrative reach stops at Orbit's own data. This is enforced structurally by §7's rule (link metadata only, real permission check on access) rather than by a special-cased "unless you're an admin" branch anywhere in the code — there is no bypass to accidentally leave in.

## 9. Multiple roles / permission union

Spatie permissions already union correctly across multiple roles a user holds (a documented, standard Spatie behavior — not something Orbit changes). For the new membership-role layer (§3), if a user is ever granted two different roles on the same project (should not normally happen, but defensively), `OrbitAuthorizationService` resolves the **highest** of the two (`admin` > `contributor` > `viewer`) rather than erroring — consistent with "permission union," not "permission conflict." Multi-role management at the org-wide Spatie level remains out of scope for Orbit to change, per the existing project-wide deferral of that feature.

## 10. Server-side authorization, always

Every check described above is enforced in controllers/services, never only in frontend conditionals. The frontend's `hasPermission()`/`moduleByKey()` (web) and membership-role checks (mobile) exist purely to hide actions a user can't take — hiding the "Delete project" button is a UX courtesy, not the security boundary. Every mutating Orbit endpoint re-derives and checks both the module gate and the membership role server-side on every request, exactly matching how every existing feature in this app already works (there is no endpoint anywhere in the current codebase that trusts a frontend-only permission check).
