<?php

namespace App\Services;

use App\Models\Employee;
use App\Models\Organization;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Collection as PermissionNameCollection;
use Illuminate\Validation\ValidationException;

/**
 * Single source of truth for "which role may this actor grant, to whom" —
 * used at employee creation, employee edit, and re-invite time. Designation
 * (Employee) and Role (User, Spatie, organization-scoped) stay fully
 * independent: this service only ever assigns the role an admin explicitly
 * chose, never one derived from designation/department/grade level.
 *
 * Authorization is a generalized rule, with one narrow, explicitly-named
 * exception: by default, an actor can never assign (or, in RoleController,
 * create/edit into) a role that grants a permission they don't currently
 * hold themselves — this is the ONLY rule for custom roles, and for every
 * standard role except the two named below, with no exception, ever.
 *
 * The exception exists because employees.manage_team (Phase 2A) broke an
 * accidental coincidence: Department Head's and Supervisor's permission
 * sets used to be strict subsets of HR Director's, which is the only reason
 * HR Director could assign either. employees.manage_team is a UI-eligibility
 * flag (Manager Home visibility), not an independent administrative
 * capability over anyone else's data, so a verified HR-administrative actor
 * — employees.assign_role AND employees.view_all, which today resolves to
 * exactly Organization Admin and HR Director, confirmed by inspecting the
 * default role definitions rather than assumed — may assign ONLY
 * Department Head or Supervisor (DELEGATED_ASSIGNMENT_ROLE_KEYS) without
 * personally holding employees.manage_team. Every other permission either
 * role carries still requires the actor to hold it themselves, unchanged.
 * Organization Admin never needs this path (passes the strict rule via
 * $all already); the path exists for HR Director.
 *
 * This delegated path explicitly:
 *  - never applies to a custom role (role->key === null), even one with an
 *    identical permission set to Department Head/Supervisor — see
 *    isAssignableByDelegatedAuthority().
 *  - never lets the actor assign the role to THEMSELVES — see
 *    assertCanAssign()'s $targetUser check. The strict, superset-based rule
 *    still permits legitimate self-assignment exactly as before; only the
 *    relaxed path is closed off, since self-assignment there would be the
 *    one case where this exception could plausibly be used to grant
 *    oneself something new.
 *  - requires an explicit target for every actual assignment. A future
 *    multi-role writer must authorize each role against that same target;
 *    a selectable role is never sufficient authorization to mutate a user.
 */
class EmployeeRoleAssignmentService
{
    /**
     * Standard role keys an HR-administrative actor may assign without
     * personally holding every permission the role carries — see the class
     * docblock. Deliberately explicit and short; never derived from "any
     * role with a key" or any broader category.
     */
    private const DELEGATED_ASSIGNMENT_ROLE_KEYS = ['department_head', 'supervisor'];

    /**
     * Permissions a delegated assignment may grant despite the actor not
     * holding them — see the class docblock for why employees.manage_team
     * specifically qualifies. Every other permission on a delegated role
     * still requires the actor to hold it themselves.
     */
    private const DELEGATED_ASSIGNMENT_EXEMPT_PERMISSIONS = ['employees.manage_team'];

    public function __construct(
        private readonly OrganizationRoleGuardrailService $guardrail,
        private readonly EmployeeProfileActivityService $activity,
    ) {
    }

    /**
     * @return Collection<int, Role>
     */
    public function assignableRolesFor(User $actor): Collection
    {
        if (! $actor->organization_id || ! $actor->can('employees.assign_role')) {
            return new Collection();
        }

        $actorPermissions = $actor->getAllPermissions()->pluck('name');

        return Role::query()
            ->where('organization_id', $actor->organization_id)
            ->with('permissions')
            ->get()
            ->filter(fn (Role $role) => $this->isAssignableBySuperset($role, $actorPermissions)
                || $this->isAssignableByDelegatedAuthority($role, $actor, $actorPermissions))
            ->values();
    }

    /** Validate a pending selection only; this does not authorize assigning a user. */
    public function assertCanSelectRole(User $actor, Role $role): void
    {
        if ($role->organization_id !== $actor->organization_id) {
            abort(404);
        }

        if (! $this->assignableRolesFor($actor)->contains(fn (Role $candidate) => $candidate->is($role))) {
            throw ValidationException::withMessages([
                'pending_role_id' => ["You are not allowed to assign the {$role->name} role."],
            ]);
        }
    }

    public function assertCanAssign(User $actor, Role $role, User $targetUser): void
    {
        abort_unless($targetUser->organization_id === $actor->organization_id, 404);
        $this->assertCanSelectRole($actor, $role);

        $actorPermissions = $actor->getAllPermissions()->pluck('name');
        $bySuperset = $this->isAssignableBySuperset($role, $actorPermissions);
        $byDelegatedAuthority = ! $bySuperset && $this->isAssignableByDelegatedAuthority($role, $actor, $actorPermissions);

        if (! $bySuperset && ! $byDelegatedAuthority) {
            throw ValidationException::withMessages([
                'pending_role_id' => ["You are not allowed to assign the {$role->name} role."],
            ]);
        }

        if ($byDelegatedAuthority && $actor->is($targetUser)) {
            throw ValidationException::withMessages([
                'pending_role_id' => ["You cannot assign yourself the {$role->name} role this way — ask another administrator to assign it."],
            ]);
        }
    }

    /**
     * @param PermissionNameCollection<int, string> $actorPermissions
     */
    private function isAssignableBySuperset(Role $role, PermissionNameCollection $actorPermissions): bool
    {
        return $role->permissions->pluck('name')->diff($actorPermissions)->isEmpty();
    }

    /**
     * @param PermissionNameCollection<int, string> $actorPermissions
     */
    private function isAssignableByDelegatedAuthority(Role $role, User $actor, PermissionNameCollection $actorPermissions): bool
    {
        if ($role->key === null || ! in_array($role->key, self::DELEGATED_ASSIGNMENT_ROLE_KEYS, true)) {
            return false;
        }

        // employees.assign_role is already required to reach this method at
        // all (assignableRolesFor()'s own guard); employees.view_all is the
        // additional, explicit "this actor's authority actually resembles
        // HR Director's" signal — org-wide employee administration, not
        // merely holding assign_role for some narrower purpose.
        if (! $actor->can('employees.assign_role') || ! $actor->can('employees.view_all')) {
            return false;
        }

        $required = $role->permissions->pluck('name')->diff(self::DELEGATED_ASSIGNMENT_EXEMPT_PERMISSIONS);

        return $required->diff($actorPermissions)->isEmpty();
    }

    public function defaultRoleFor(Organization $organization): ?Role
    {
        return Role::query()
            ->where('organization_id', $organization->id)
            ->where('key', 'employee')
            ->first();
    }

    /**
     * Applies whatever role was chosen for $employee (if any) to the
     * now-existing $targetUser. Called once, at the moment a User account is
     * created for an employee (inline at invite, or later via a lifecycle
     * status transition).
     */
    public function applyRoleSelection(User $actor, Employee $employee, User $targetUser): void
    {
        if ($employee->organization_id !== $actor->organization_id || $targetUser->organization_id !== $actor->organization_id) {
            abort(404);
        }

        $role = $employee->pendingRole;

        if ($role === null) {
            $this->assignDefault($employee, $targetUser);

            return;
        }

        try {
            $this->assertCanAssign($actor, $role, $targetUser);
        } catch (ValidationException) {
            // The actor re-inviting/re-processing this employee no longer has
            // (or never had) standing to grant the previously-chosen role —
            // fall back to the safe default rather than blocking the invite.
            $this->assignDefault($employee, $targetUser);

            return;
        }

        $targetUser->syncRoles([$role]);
        $employee->update(['pending_role_id' => null]);
        $this->activity->record($employee, $actor, 'employee_role_assigned', "Assigned the {$role->name} role.", subject: $role);
    }

    /**
     * Immediately re-syncs a live User's role — used by the employee edit
     * flow, where the account (unlike at creation) already exists.
     */
    public function updateAssignedRole(User $actor, Employee $employee, User $targetUser, ?int $roleId): void
    {
        if ($employee->organization_id !== $actor->organization_id) {
            abort(404);
        }

        abort_unless($employee->user_id === $targetUser->id && app(EmployeeVisibility::class)->allows($actor, $employee->id), 404);

        if ($roleId === null) {
            $role = $this->defaultRoleFor($employee->organization);

            if ($role === null) {
                throw ValidationException::withMessages([
                    'pending_role_id' => ['This organization has no default role configured — choose a role explicitly.'],
                ]);
            }
        } else {
            $role = Role::query()->where('organization_id', $employee->organization_id)->findOrFail($roleId);
        }

        $this->assertCanAssign($actor, $role, $targetUser);

        $currentRole = $targetUser->roles->first();

        if (
            $currentRole
            && ! $currentRole->is($role)
            && $this->guardrail->wouldCauseLockout($employee->organization, excludingUser: $targetUser)
        ) {
            throw ValidationException::withMessages([
                'pending_role_id' => ['This is the last user who can administer roles in this organization — promote someone else first.'],
            ]);
        }

        $targetUser->syncRoles([$role]);
        $employee->update(['pending_role_id' => null]);
        $message = $roleId === null ? "Role reset to the default ({$role->name})." : "Role changed to {$role->name}.";
        $this->activity->record($employee, $actor, 'employee_role_changed', $message, subject: $role);
    }

    private function assignDefault(Employee $employee, User $targetUser): void
    {
        $default = $this->defaultRoleFor($employee->organization);

        if ($default) {
            $targetUser->syncRoles([$default]);
        }

        $employee->update(['pending_role_id' => null]);
    }
}
