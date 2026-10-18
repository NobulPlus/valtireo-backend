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
 * "Admin-capable" = EFFECTIVE permissions (the union across every role a
 * user holds, not any single role in isolation) include both roles.update
 * and employees.assign_role — the two permissions needed to recover from
 * any other lockout state (reshape a role, and hand it to someone). A user
 * can be admin-capable by holding one role with both, or by holding two
 * roles that each grant one — both must count, now that a user can hold
 * more than one role.
 */
class OrganizationRoleGuardrailService
{
    private const REQUIRED_PERMISSIONS = ['roles.update', 'employees.assign_role'];

    /**
     * @param User|null $excludingUser Simulate this user losing admin capability entirely (e.g. being reassigned/deactivated) — every role they hold is ignored for them.
     * @param Role|null $excludingRole Simulate this role's permission grant changing, for every user who holds it.
     * @param array<int, string>|null $replacementPermissionNames Only meaningful together with $excludingRole. Null (the default) simulates the role no longer existing at all (e.g. being deleted) — it contributes nothing. A non-null array simulates the role being UPDATED to exactly these permissions instead of its current ones (e.g. a permission-set edit that hasn't been saved yet) — this still credits whatever the role would keep, so a user who separately holds another role covering the other required permission is correctly still counted as admin-capable. Passing an empty array is equivalent to the default (contributes nothing).
     */
    public function wouldCauseLockout(
        Organization $organization,
        ?User $excludingUser = null,
        ?Role $excludingRole = null,
        ?array $replacementPermissionNames = null,
    ): bool {
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

            // The user's EFFECTIVE permission set: the union across every
            // role they hold, substituting $replacementPermissionNames for
            // $excludingRole's own current permissions where applicable —
            // never zeroing out a role a user holds unless that's actually
            // what's being simulated. This is what makes a two-role split
            // (one role granting roles.update, a separate one granting
            // employees.assign_role) correctly count as admin-capable,
            // where checking each role in isolation would not.
            $effectivePermissionNames = $user->roles
                ->flatMap(function (Role $role) use ($excludingRole, $replacementPermissionNames) {
                    if ($excludingRole && $role->is($excludingRole)) {
                        return $replacementPermissionNames ?? [];
                    }

                    return $role->permissions->pluck('name');
                })
                ->unique();

            if (collect(self::REQUIRED_PERMISSIONS)->every(fn (string $permission) => $effectivePermissionNames->contains($permission))) {
                return false;
            }
        }

        return true;
    }
}
