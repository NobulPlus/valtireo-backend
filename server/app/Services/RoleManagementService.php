<?php

namespace App\Services;

use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Backs RoleController — organization-owned role CRUD. Every create/update
 * enforces the same generalized escalation rule as
 * EmployeeRoleAssignmentService: an actor can never grant a permission they
 * don't currently hold themselves. `key` is never client-settable — custom
 * roles created here always have key = null.
 */
class RoleManagementService
{
    private const ADMIN_CAPABLE_PERMISSIONS = ['roles.update', 'employees.assign_role'];

    public function __construct(
        private readonly OrganizationRoleGuardrailService $guardrail,
        private readonly RoleActivityService $activity,
    ) {
    }

    /**
     * @return Collection<int, Role>
     */
    public function listFor(User $actor): Collection
    {
        return Role::query()
            ->where('organization_id', $actor->organization_id)
            ->with('permissions')
            ->withCount('users')
            ->orderBy('name')
            ->get();
    }

    /**
     * @param array<string, mixed> $data
     */
    public function create(User $actor, array $data): Role
    {
        $permissionNames = $data['permission_names'] ?? [];
        $this->assertGrantable($actor, $permissionNames);

        return DB::transaction(function () use ($actor, $data, $permissionNames): Role {
            $role = Role::query()->create([
                'organization_id' => $actor->organization_id,
                'guard_name' => 'web',
                'key' => null,
                'name' => $data['name'],
                'description' => $data['description'] ?? null,
            ]);

            $role->syncPermissions($permissionNames);
            $this->activity->record($actor->organization, $role, $actor, 'role_created', "Created the {$role->name} role.");

            return $role;
        });
    }

    /**
     * @param array<string, mixed> $data
     */
    public function update(User $actor, Role $role, array $data): Role
    {
        $this->assertTenant($actor, $role);

        $permissionNames = array_key_exists('permission_names', $data) ? $data['permission_names'] : null;

        if ($permissionNames !== null) {
            $this->assertGrantable($actor, $permissionNames);
            $this->assertNoLockout($actor, $role, $permissionNames);
        }

        return DB::transaction(function () use ($actor, $role, $data, $permissionNames): Role {
            $previousName = $role->name;

            $role->update([
                'name' => $data['name'] ?? $role->name,
                'description' => array_key_exists('description', $data) ? $data['description'] : $role->description,
            ]);

            if ($permissionNames !== null) {
                $role->syncPermissions($permissionNames);
            }

            $renamed = $previousName !== $role->name;
            $this->activity->record(
                $actor->organization,
                $role,
                $actor,
                $renamed ? 'role_renamed' : 'role_updated',
                $renamed ? "Renamed the \"{$previousName}\" role to \"{$role->name}\"." : "Updated the {$role->name} role."
            );

            return $role->fresh('permissions');
        });
    }

    public function delete(User $actor, Role $role): void
    {
        $this->assertTenant($actor, $role);

        $userCount = $role->users()->count();

        if ($userCount > 0) {
            throw ValidationException::withMessages([
                'role' => ["This role is currently assigned to {$userCount} user(s) — reassign them before deleting it."],
            ]);
        }

        if ($this->guardrail->wouldCauseLockout($actor->organization, excludingRole: $role)) {
            throw ValidationException::withMessages([
                'role' => ['Deleting this role would leave the organization with no one able to administer roles.'],
            ]);
        }

        DB::transaction(function () use ($actor, $role): void {
            $name = $role->name;
            $role->delete();
            $this->activity->record($actor->organization, null, $actor, 'role_deleted', "Deleted the {$name} role.");
        });
    }

    /**
     * @param array<int, string> $permissionNames
     */
    private function assertGrantable(User $actor, array $permissionNames): void
    {
        $actorPermissions = $actor->getAllPermissions()->pluck('name');
        $missing = collect($permissionNames)->diff($actorPermissions);

        if ($missing->isNotEmpty()) {
            throw ValidationException::withMessages([
                'permission_names' => ["You cannot grant permission(s) you don't hold yourself: {$missing->implode(', ')}."],
            ]);
        }
    }

    /**
     * @param array<int, string> $newPermissionNames
     */
    private function assertNoLockout(User $actor, Role $role, array $newPermissionNames): void
    {
        $currentNames = $role->permissions->pluck('name');
        $currentlyAdminCapable = collect(self::ADMIN_CAPABLE_PERMISSIONS)->every(fn (string $permission) => $currentNames->contains($permission));
        $stillAdminCapable = collect(self::ADMIN_CAPABLE_PERMISSIONS)->every(fn (string $permission) => in_array($permission, $newPermissionNames, true));

        if ($currentlyAdminCapable && ! $stillAdminCapable && $this->guardrail->wouldCauseLockout($actor->organization, excludingRole: $role)) {
            throw ValidationException::withMessages([
                'permission_names' => ['Removing these permissions would leave the organization with no one able to administer roles.'],
            ]);
        }
    }

    private function assertTenant(User $actor, Role $role): void
    {
        if ($role->organization_id !== $actor->organization_id) {
            abort(404);
        }
    }
}
