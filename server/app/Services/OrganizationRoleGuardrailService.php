<?php

namespace App\Services;

use App\Models\Organization;
use App\Models\Role;
use App\Models\User;
use Spatie\Permission\PermissionRegistrar;

/**
 * Prevents an organization from ever reaching zero active users capable of
 * administering roles — the one deliberately narrow lockout guardrail: it
 * only blocks the operation that would cause total lockout, never a mere
 * reduction in access, which is ordinary role administration.
 *
 * "Admin-capable" = holds a role granting both roles.update and
 * employees.assign_role — the two permissions needed to recover from any
 * other lockout state (reshape a role, and hand it to someone).
 */
class OrganizationRoleGuardrailService
{
    private const REQUIRED_PERMISSIONS = ['roles.update', 'employees.assign_role'];

    /**
     * @param User|null $excludingUser Simulate this user losing admin capability (e.g. being reassigned/deactivated).
     * @param Role|null $excludingRole Simulate this role no longer granting admin capability (e.g. being deleted or edited down).
     */
    public function wouldCauseLockout(Organization $organization, ?User $excludingUser = null, ?Role $excludingRole = null): bool
    {
        app(PermissionRegistrar::class)->setPermissionsTeamId($organization->id);

        $users = User::query()
            ->where('organization_id', $organization->id)
            ->with('employee', 'roles.permissions')
            ->get();

        foreach ($users as $user) {
            if ($excludingUser && $user->is($excludingUser)) {
                continue;
            }

            // "Active" here means: not tied to an employee record that's
            // suspended/exited. Users with no employee record at all (e.g.
            // console-only Organization Admin accounts) count as active —
            // there's no separate deactivation mechanism for them today.
            if ($user->employee && in_array($user->employee->status, ['suspended', 'exited'], true)) {
                continue;
            }

            foreach ($user->roles as $role) {
                if ($excludingRole && $role->is($excludingRole)) {
                    continue;
                }

                $permissionNames = $role->permissions->pluck('name');

                if (collect(self::REQUIRED_PERMISSIONS)->every(fn (string $permission) => $permissionNames->contains($permission))) {
                    return false;
                }
            }
        }

        return true;
    }
}
