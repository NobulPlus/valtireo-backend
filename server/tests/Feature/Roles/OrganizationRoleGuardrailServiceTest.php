<?php

namespace Tests\Feature\Roles;

use App\Models\Employee;
use App\Models\Organization;
use App\Models\Role;
use App\Models\User;
use App\Services\OrganizationRoleGuardrailService;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Focused, isolated coverage for the lockout-detection fix: every scenario
 * builds its own fresh Organization (never the seeded Valtireo/demo orgs),
 * so none of these tests depend on — or could be broken by a future change
 * to — any shared standard role's permissions.
 */
class OrganizationRoleGuardrailServiceTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        // Only the global permission catalog — not the full DatabaseSeeder,
        // which would also create demo organizations these tests have no
        // use for and must stay independent of.
        $this->seed(RolePermissionSeeder::class);
    }

    private function organization(): Organization
    {
        return Organization::query()->create([
            'name' => 'Guardrail Test Org',
            'code' => 'GUARDRAILTEST'.uniqid(),
            'status' => 'active',
            'country' => 'Nigeria',
            'settings' => [],
        ]);
    }

    /**
     * @param array<int, string> $permissionNames
     */
    private function role(Organization $organization, string $name, array $permissionNames): Role
    {
        $this->setPermissionsTeamId($organization->id);

        $role = Role::create([
            'organization_id' => $organization->id,
            'guard_name' => 'web',
            'key' => null,
            'name' => $name,
        ]);
        $role->syncPermissions($permissionNames);

        return $role;
    }

    /**
     * @param array<int, Role> $roles
     */
    private function user(Organization $organization, array $roles): User
    {
        $this->setPermissionsTeamId($organization->id);

        $user = User::factory()->create(['organization_id' => $organization->id]);
        $user->syncRoles($roles);

        return $user;
    }

    private function guardrail(): OrganizationRoleGuardrailService
    {
        return app(OrganizationRoleGuardrailService::class);
    }

    public function test_a_single_role_holding_both_required_permissions_is_not_a_lockout(): void
    {
        $organization = $this->organization();
        $adminRole = $this->role($organization, 'Full Admin', ['roles.update', 'employees.assign_role']);
        $this->user($organization, [$adminRole]);

        $this->assertFalse($this->guardrail()->wouldCauseLockout($organization));
    }

    public function test_an_org_with_no_admin_capable_user_at_all_is_a_genuine_lockout(): void
    {
        $organization = $this->organization();
        $plainRole = $this->role($organization, 'Plain', ['leave_requests.create']);
        $this->user($organization, [$plainRole]);

        $this->assertTrue($this->guardrail()->wouldCauseLockout($organization));
    }

    public function test_required_permissions_split_across_two_roles_on_one_user_counts_as_admin_capable(): void
    {
        // The exact bug this fix addresses: neither role alone satisfies
        // both required permissions, but the user's EFFECTIVE (combined)
        // grant does. Checking each role in isolation — the pre-fix
        // behavior — would have incorrectly reported this as a lockout.
        $organization = $this->organization();
        $roleA = $this->role($organization, 'Role Updater', ['roles.update']);
        $roleB = $this->role($organization, 'Role Assigner', ['employees.assign_role']);
        $this->user($organization, [$roleA, $roleB]);

        $this->assertFalse($this->guardrail()->wouldCauseLockout($organization));
    }

    public function test_excluding_one_of_a_users_two_covering_roles_correctly_becomes_a_lockout(): void
    {
        $organization = $this->organization();
        $roleA = $this->role($organization, 'Role Updater', ['roles.update']);
        $roleB = $this->role($organization, 'Role Assigner', ['employees.assign_role']);
        $this->user($organization, [$roleA, $roleB]);

        // Simulating roleA being deleted: the user still holds roleB, but
        // that alone doesn't cover roles.update, so this user is correctly
        // no longer admin-capable — and, being the only one, this is a
        // genuine lockout.
        $this->assertTrue($this->guardrail()->wouldCauseLockout($organization, excludingRole: $roleA));
    }

    public function test_updating_a_role_to_a_reduced_permission_set_is_not_a_false_lockout_when_another_role_still_covers_the_rest(): void
    {
        // The second half of the fix: evaluating the EFFECTIVE permissions
        // after a proposed UPDATE (not treating the updated role as if it
        // vanished entirely) must credit what it would still grant, and
        // must recognize a separately-held role covering what it drops.
        $organization = $this->organization();
        $combinedRole = $this->role($organization, 'Combined', ['roles.update', 'employees.assign_role']);
        $assignRole = $this->role($organization, 'Assigner Only', ['employees.assign_role']);
        $this->user($organization, [$combinedRole, $assignRole]);

        // $combinedRole is being updated to drop employees.assign_role,
        // keeping only roles.update. Treating it as fully excluded (the
        // pre-fix-equivalent simulation) would make this look like a
        // lockout — checked alone it no longer satisfies both — but the
        // user's separate $assignRole still covers employees.assign_role,
        // and $combinedRole's own remaining roles.update covers the other.
        $this->assertFalse($this->guardrail()->wouldCauseLockout(
            $organization,
            excludingRole: $combinedRole,
            replacementPermissionNames: ['roles.update'],
        ));
    }

    public function test_updating_a_role_down_to_an_insufficient_set_with_no_other_coverage_is_a_genuine_lockout(): void
    {
        $organization = $this->organization();
        $combinedRole = $this->role($organization, 'Combined', ['roles.update', 'employees.assign_role']);
        $this->user($organization, [$combinedRole]);

        $this->assertTrue($this->guardrail()->wouldCauseLockout(
            $organization,
            excludingRole: $combinedRole,
            replacementPermissionNames: ['roles.update'],
        ));
    }

    public function test_an_empty_replacement_permission_set_behaves_the_same_as_full_exclusion(): void
    {
        $organization = $this->organization();
        $combinedRole = $this->role($organization, 'Combined', ['roles.update', 'employees.assign_role']);
        $this->user($organization, [$combinedRole]);

        $this->assertTrue($this->guardrail()->wouldCauseLockout($organization, excludingRole: $combinedRole, replacementPermissionNames: []));
        $this->assertTrue($this->guardrail()->wouldCauseLockout($organization, excludingRole: $combinedRole));
    }

    public function test_deleting_a_role_is_a_lockout_only_until_another_role_covers_it_org_wide(): void
    {
        $organization = $this->organization();
        $onlyAdminRole = $this->role($organization, 'Only Admin', ['roles.update', 'employees.assign_role']);
        $this->user($organization, [$onlyAdminRole]);

        $this->assertTrue($this->guardrail()->wouldCauseLockout($organization, excludingRole: $onlyAdminRole));

        $otherAdminRole = $this->role($organization, 'Other Admin', ['roles.update', 'employees.assign_role']);
        $this->user($organization, [$otherAdminRole]);

        $this->assertFalse($this->guardrail()->wouldCauseLockout($organization, excludingRole: $onlyAdminRole));
    }

    public function test_excluding_a_user_who_is_the_only_admin_capable_person_via_two_roles_is_a_genuine_lockout(): void
    {
        // Reassignment-shaped simulation: EmployeeRoleAssignmentService
        // calls wouldCauseLockout(excludingUser: $targetUser) when moving
        // someone off their current role. This must still work correctly
        // when that user's admin capability comes from TWO roles, not one.
        $organization = $this->organization();
        $roleA = $this->role($organization, 'Role Updater', ['roles.update']);
        $roleB = $this->role($organization, 'Role Assigner', ['employees.assign_role']);
        $theOnlyAdmin = $this->user($organization, [$roleA, $roleB]);

        $this->assertTrue($this->guardrail()->wouldCauseLockout($organization, excludingUser: $theOnlyAdmin));
    }

    public function test_excluding_a_user_is_not_a_lockout_when_a_different_user_independently_covers_admin_capability(): void
    {
        $organization = $this->organization();
        $roleA = $this->role($organization, 'Role Updater', ['roles.update']);
        $roleB = $this->role($organization, 'Role Assigner', ['employees.assign_role']);
        $theMultiRoleUser = $this->user($organization, [$roleA, $roleB]);

        $fullAdminRole = $this->role($organization, 'Full Admin', ['roles.update', 'employees.assign_role']);
        $this->user($organization, [$fullAdminRole]);

        $this->assertFalse($this->guardrail()->wouldCauseLockout($organization, excludingUser: $theMultiRoleUser));
    }

    public function test_a_suspended_employees_admin_capability_does_not_count_even_when_split_across_two_roles(): void
    {
        $organization = $this->organization();
        $roleA = $this->role($organization, 'Role Updater', ['roles.update']);
        $roleB = $this->role($organization, 'Role Assigner', ['employees.assign_role']);
        $user = $this->user($organization, [$roleA, $roleB]);

        Employee::factory()->create([
            'organization_id' => $organization->id,
            'user_id' => $user->id,
            'status' => 'suspended',
        ]);

        $this->assertTrue($this->guardrail()->wouldCauseLockout($organization));
    }

    public function test_tenant_boundary_a_second_organizations_admin_capable_user_never_counts(): void
    {
        $organizationA = $this->organization();
        $organizationB = $this->organization();

        $plainRole = $this->role($organizationA, 'Plain', ['leave_requests.create']);
        $this->user($organizationA, [$plainRole]);

        $adminRoleB = $this->role($organizationB, 'Full Admin', ['roles.update', 'employees.assign_role']);
        $this->user($organizationB, [$adminRoleB]);

        $this->assertTrue($this->guardrail()->wouldCauseLockout($organizationA));
        $this->assertFalse($this->guardrail()->wouldCauseLockout($organizationB));
    }
}
