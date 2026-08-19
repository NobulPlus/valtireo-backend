<?php

namespace App\Services;

use App\Models\Employee;
use App\Models\Organization;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Validation\ValidationException;

/**
 * Single source of truth for "which role may this actor grant, to whom" —
 * used at employee creation, employee edit, and re-invite time. Designation
 * (Employee) and Role (User, Spatie, organization-scoped) stay fully
 * independent: this service only ever assigns the role an admin explicitly
 * chose, never one derived from designation/department/grade level.
 *
 * Authorization is a single, generalized rule that works identically for the
 * seeded starter roles and any organization-custom role: an actor can never
 * assign (or, in RoleController, create/edit into) a role that grants a
 * permission they don't currently hold themselves. No role names are
 * hardcoded anywhere in this class.
 */
class EmployeeRoleAssignmentService
{
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
            ->filter(fn (Role $role) => $role->permissions->pluck('name')->diff($actorPermissions)->isEmpty())
            ->values();
    }

    public function assertCanAssign(User $actor, Role $role): void
    {
        if ($role->organization_id !== $actor->organization_id) {
            abort(404);
        }

        if (! $this->assignableRolesFor($actor)->contains(fn (Role $assignable) => $assignable->is($role))) {
            throw ValidationException::withMessages([
                'pending_role_id' => ["You are not allowed to assign the {$role->name} role."],
            ]);
        }
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
        if ($employee->organization_id !== $actor->organization_id) {
            abort(404);
        }

        $role = $employee->pendingRole;

        if ($role === null) {
            $this->assignDefault($employee, $targetUser);

            return;
        }

        try {
            $this->assertCanAssign($actor, $role);
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
        if ($roleId === null) {
            return;
        }

        if ($employee->organization_id !== $actor->organization_id) {
            abort(404);
        }

        $role = Role::query()->where('organization_id', $employee->organization_id)->findOrFail($roleId);

        $this->assertCanAssign($actor, $role);

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
        $this->activity->record($employee, $actor, 'employee_role_changed', "Role changed to {$role->name}.", subject: $role);
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
