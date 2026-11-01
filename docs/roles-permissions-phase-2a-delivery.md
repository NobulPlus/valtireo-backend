# Roles and permissions: Phase 2A delivery

Scope: Manager Home eligibility and narrowly delegated standard-role assignment only. Phase 2B, multiple-role assignment APIs, new mobile administration screens and Connect are outside this change.

## Starting state

Inspected branch `feature/design-system-v2-login` at `ad6b1a3f8e39f02bf4ffabccad354f47ed3d3c58`, matching the handover. Phase 1 organization lockout protection was already committed and was not rewritten. Claude left Phase 2A uncommitted in these files:

- `server/app/Services/DashboardService.php`
- `server/app/Services/DefaultRoleSeedingService.php`
- `server/app/Services/EmployeeRoleAssignmentService.php`
- `server/database/seeders/RolePermissionSeeder.php`
- `server/database/migrations/2026_10_19_010000_grant_employees_manage_team_permission_to_default_roles.php` (untracked)
- `server/tests/Feature/Auth/AuthenticationTest.php`
- `server/tests/Feature/Dashboard/DashboardTest.php`
- `server/tests/Feature/Employees/EmployeeRoleAssignmentTest.php`
- `client/src/context/AuthContext.tsx`
- `mobile/src/features/dashboard/api.ts`
- `mobile/src/lib/managerEligibility.ts`

Unrelated `.claude/` and `.worktrees/valtireo-life-discovery` changes were present and left untouched. The existing Phase 2A work was completed in place, not discarded. Additional Phase 2A files are `server/app/Services/EmployeeOnboardingService.php`, `server/app/Http/Controllers/Api/EmployeeController.php`, `server/tests/Feature/Roles/PhaseTwoAAuthorizationTest.php` and this report.

## Authorization behavior

### Manager Home

New default roles Organization Admin, Department Head and Supervisor include `employees.manage_team`. HR Director, HR Officer and Compliance Officer retain their existing visibility grants but do not receive this permission by default. Payroll Administrator, ICT Admin and Employee do not receive it either.

`has_manager_scope` is true only for an active employee belonging to the authenticated user/organization who holds `employees.manage_team` AND has an eligible structural assignment with its existing visibility permission:

- Their own department's head, with `employees.view_department`.
- Manager/supervisor of an active same-organization cluster, with `employees.view_team`.
- At least one same-organization direct report, with `employees.view_team`.

The permission alone does not make a person a manager or grant employee editing, payroll, approvals or role-management actions. `EmployeeVisibility` remains unchanged. Manager dashboard queries, including the separate direct-report list, intersect that visibility scope. Existing explicit web reporting by department/cluster remains available under its pre-existing `reports.view` plus organization-wide employee visibility check; this is distinct from natural Manager Home eligibility.

### Delegated assignment

The normal rule remains: actor must have `employees.assign_role` and every permission in the requested role. It applies to all custom roles and all standard roles outside the two approved keys.

The exception requires `employees.assign_role` AND `employees.view_all`, an organization-local role with key `department_head` or `supervisor`, and possession of every target-role permission except `employees.manage_team`. Renamed standard roles still match their internal key; identical custom roles do not. Adding another sensitive permission to a standard role does not make that permission delegable.

Actual authorization requires an explicit target user, in the same organization, and rejects self-assignment on the delegated path even if the actor already has multiple roles. Live employee role changes additionally verify the employee/user link and the actor's employee visibility. A future multiple-role writer must call the same target-aware authorization for each requested role, not treat picker results as an authorization grant. No new multiple-role assignment support is implemented here.

`assertCanSelectRole()` is only pending-selection validation for employee creation and a staged role before an account exists. `assertCanAssign()` performs target-aware authorization at actual assignment. The original invitation default/fallback behavior remains; unauthorized pending selections use validation exceptions so the existing safe-default fallback is preserved. Existing role changes still replace the single selected role. `RoleManagementService::assertGrantable()` and Phase 1 lockout logic are unchanged.

## API compatibility

- `GET /api/auth/me` and login retain their response fields and types, including boolean `has_manager_scope`, `roles`, `permissions`, `modules`, workspace and user data. Only the intended eligibility semantics change.
- `GET /api/dashboard/manager` retains its response shape and explicit reporting filters. A caller with no eligible natural scope receives 403 instead of an empty manager dashboard.
- `GET /api/setup/assignable-roles` retains its option format. It may list delegated roles for HR administration; the final mutation still rejects self-assignment.
- Employee creation/update continue using scalar `pending_role_id`; there is no role-array payload or new invitation workflow.
- Mobile and web changes are comments documenting the backend contract; existing client eligibility uses the server boolean. No new native API, package, screen or navigation is introduced.

## Existing organizations and rollout

The partial migration would have granted the new permission to every existing role bearing one of three keys, including customized roles. That would expand customer access without review. The completed migration keeps its original filename but registers the permission catalog entry only; it does not modify existing role grants or production records. Newly created default roles receive the approved permissions from `DefaultRoleSeedingService`.

Before rollout to an existing organization, explicitly review which roles should receive `employees.manage_team`, including custom people-manager roles. Grant through the existing audited role editor under an administrator's authority. Until granted, that organization's users will no longer qualify for natural Manager Home under the new rule. Existing employee visibility and explicit reporting remain intact. No role grants were backfilled and no local or production application database migration was run during this task.

The migration is idempotent and its rollback does not delete permissions that customers may have assigned. Deployment must coordinate catalog registration and reviewed grants before enabling the updated Manager Home behavior. A standard role key alone is not proof that an organization still wants the default permissions.

## Validation

The full backend suite passed on 20 October 2026: **502 tests, 3,343 assertions, zero errors, failures or skips**, verified from the saved JUnit report. Command: `php -d opcache.enable_cli=1 vendor/phpunit/phpunit/phpunit --log-junit tmp/phase2a-full.xml` (Herd PHP 8.4). Runtime was approximately 104.5 minutes. The log contains a vendor Faker PHP 8.4 nullable-parameter deprecation; vendor files were not changed. An earlier full-suite attempt exited without a usable summary and is not counted as a passing run.

The initial focused run (`php artisan test --filter='EmployeeRoleAssignmentTest|DashboardTest|AuthenticationTest|RoleManagementTest'`) had 96 passing tests and one failing department-head fixture: its generated department belonged to another organization. The fixture was corrected to use a department from its own tenant; the authorization rule was not weakened. A focused rerun of the corrected fixture and then-existing PhaseTwoAAuthorization tests passed (8 tests, 33 assertions). The full suite subsequently covered all ten new PhaseTwoAAuthorization tests.

Web `tsc -b` passed; `npm run lint` completed with 15 existing warnings and no errors. Mobile `npm run lint` completed with one existing unused-import warning in `src/features/calendar/api.ts`; `npm run typecheck` and all 24 `npm test` contract tests passed. `git diff --check` passed. No unrelated warnings were fixed in this change.

## Review limits

This is not the deferred sensitive-field/payroll separation-of-duties work, structural-assignment warning UI, or focus-triggered web refresh phase. Revocation is enforced server-side on subsequent requests; this phase does not add a real-time client session invalidation channel. Tests using Spatie's existing permission union do not imply a new multiple-role administration workflow. No live device visual acceptance or production rollout is claimed.
