<?php

namespace Tests\Feature\Roles;

use App\Models\Organization;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class RoleManagementTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
    }

    private function roleId(string $key): int
    {
        $organization = Organization::query()->where('code', 'VALTIREO')->firstOrFail();

        return Role::query()->where('organization_id', $organization->id)->where('key', $key)->firstOrFail()->id;
    }

    public function test_admin_can_list_roles_with_permissions_and_user_count(): void
    {
        $this->seed();

        Sanctum::actingAs($this->admin());

        $this->getJson('/api/roles')
            ->assertOk()
            ->assertJsonFragment(['key' => 'employee'])
            ->assertJsonStructure(['data' => [['id', 'key', 'name', 'description', 'permissions', 'user_count']]]);
    }

    public function test_admin_can_create_a_custom_role(): void
    {
        $this->seed();

        Sanctum::actingAs($this->admin());

        $this->postJson('/api/roles', [
            'name' => 'Facilities Coordinator',
            'description' => 'Handles facilities requests.',
            'permission_names' => ['organizations.view', 'service_desk.view'],
        ])
            ->assertCreated()
            ->assertJsonPath('role.name', 'Facilities Coordinator')
            ->assertJsonPath('role.key', null)
            ->assertJsonPath('role.user_count', 0);

        $this->assertDatabaseHas('roles', ['name' => 'Facilities Coordinator', 'key' => null]);
    }

    public function test_cannot_create_a_role_granting_a_permission_the_actor_does_not_hold(): void
    {
        $this->seed();

        $admin = $this->admin();
        Sanctum::actingAs($admin);

        // No seeded starter role holds roles.create except Organization
        // Admin (via the wildcard $all permission set), and Organization
        // Admin can never fail the "grantable" subset check. So to exercise
        // assertGrantable()'s rejection path we need an actor who can reach
        // the endpoint (holds roles.create) but doesn't hold every
        // permission — a purpose-built limited role.
        $limitedRoleId = $this->postJson('/api/roles', [
            'name' => 'Limited Role Creator',
            'permission_names' => ['roles.create'],
        ])->assertCreated()->json('role.id');

        $limitedUser = User::factory()->create(['organization_id' => $admin->organization_id]);
        $this->setPermissionsTeamId($admin->organization_id);
        $limitedUser->assignRole(Role::query()->findOrFail($limitedRoleId));

        Sanctum::actingAs($limitedUser);
        $this->postJson('/api/roles', [
            'name' => 'Overreaching Role',
            'permission_names' => ['leave_requests.approve'],
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['permission_names']);
    }

    public function test_admin_can_rename_and_reassign_permissions_of_a_role(): void
    {
        $this->seed();

        Sanctum::actingAs($this->admin());

        $roleId = $this->postJson('/api/roles', [
            'name' => 'Temp Role',
            'permission_names' => ['organizations.view'],
        ])->assertCreated()->json('role.id');

        $this->patchJson("/api/roles/{$roleId}", [
            'name' => 'Renamed Role',
            'permission_names' => ['organizations.view', 'service_desk.view'],
        ])
            ->assertOk()
            ->assertJsonPath('role.name', 'Renamed Role')
            ->assertJsonFragment(['permissions' => ['organizations.view', 'service_desk.view']]);
    }

    public function test_cannot_update_a_role_in_a_way_that_would_lock_the_organization_out(): void
    {
        $this->seed();

        Sanctum::actingAs($this->admin());
        $adminRoleId = $this->roleId('organization_admin');

        $this->patchJson("/api/roles/{$adminRoleId}", [
            'permission_names' => ['organizations.view'],
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['permission_names']);
    }

    public function test_cannot_delete_a_role_currently_assigned_to_a_user(): void
    {
        $this->seed();

        Sanctum::actingAs($this->admin());
        $ictAdminRoleId = $this->roleId('ict_admin');

        $this->deleteJson("/api/roles/{$ictAdminRoleId}")
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['role']);
    }

    public function test_cannot_delete_the_organizations_default_employee_role(): void
    {
        $this->seed();

        Sanctum::actingAs($this->admin());
        $employeeRoleId = $this->roleId('employee');

        $this->deleteJson("/api/roles/{$employeeRoleId}")
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['role']);

        $this->assertDatabaseHas('roles', ['id' => $employeeRoleId]);
    }

    public function test_admin_can_delete_an_unused_custom_role(): void
    {
        $this->seed();

        Sanctum::actingAs($this->admin());

        $roleId = $this->postJson('/api/roles', [
            'name' => 'Unused Role',
            'permission_names' => ['organizations.view'],
        ])->assertCreated()->json('role.id');

        $this->deleteJson("/api/roles/{$roleId}")->assertOk();

        $this->assertDatabaseMissing('roles', ['id' => $roleId]);
    }

    public function test_cannot_update_or_delete_another_organizations_role(): void
    {
        $this->seed();

        $otherOrganization = Organization::query()->create([
            'name' => 'Other Role Tenant',
            'code' => 'OTHERROLE',
            'status' => 'active',
            'country' => 'Nigeria',
            'settings' => [],
        ]);
        $otherRole = Role::query()->create([
            'organization_id' => $otherOrganization->id,
            'guard_name' => 'web',
            'key' => null,
            'name' => 'Other Org Role',
        ]);

        Sanctum::actingAs($this->admin());

        $this->patchJson("/api/roles/{$otherRole->id}", ['name' => 'Hijacked'])->assertNotFound();
        $this->deleteJson("/api/roles/{$otherRole->id}")->assertNotFound();
    }

    public function test_role_activity_is_recorded_and_listed(): void
    {
        $this->seed();

        Sanctum::actingAs($this->admin());

        $roleId = $this->postJson('/api/roles', [
            'name' => 'Audited Role',
            'permission_names' => ['organizations.view'],
        ])->assertCreated()->json('role.id');

        $this->patchJson("/api/roles/{$roleId}", ['name' => 'Renamed Audited Role'])->assertOk();
        $this->deleteJson("/api/roles/{$roleId}")->assertOk();

        $response = $this->getJson('/api/roles/activities')->assertOk();

        $events = collect($response->json('data'))->pluck('event');
        $this->assertTrue($events->contains('role_created'));
        $this->assertTrue($events->contains('role_renamed'));
        $this->assertTrue($events->contains('role_deleted'));

        // The deletion event has no role relation left (the role is gone)
        // but must still surface in the org-wide feed.
        $deletionEvent = collect($response->json('data'))->firstWhere('event', 'role_deleted');
        $this->assertNull($deletionEvent['role']);
    }

    public function test_role_activities_require_roles_view_permission(): void
    {
        $this->seed();

        Sanctum::actingAs(User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail());

        $this->getJson('/api/roles/activities')->assertForbidden();
    }
}
