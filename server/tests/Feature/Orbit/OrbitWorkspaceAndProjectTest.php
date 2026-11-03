<?php

namespace Tests\Feature\Orbit;

use App\Models\Organization;
use App\Models\OrbitProject;
use App\Models\OrbitWorkspace;
use App\Models\OrbitWorkspaceMember;
use App\Models\PlatformModule;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class OrbitWorkspaceAndProjectTest extends TestCase
{
    use RefreshDatabase, SetsUpOrbitOrganization;

    public function test_unsubscribed_organization_is_rejected_on_every_orbit_route(): void
    {
        $this->seed(\Database\Seeders\RolePermissionSeeder::class);

        $organization = Organization::create(['name' => 'No Orbit Ltd', 'code' => 'NOORBIT', 'status' => 'active', 'country' => 'Nigeria', 'settings' => []]);
        $this->setPermissionsTeamId($organization->id);
        $roles = app(\App\Services\DefaultRoleSeedingService::class)->seedForOrganization($organization);

        $admin = User::create(['organization_id' => $organization->id, 'name' => 'No Orbit Admin', 'email' => 'noorbit-admin@test.local', 'password' => 'Password1!']);
        $admin->syncRoles([$roles->get('organization_admin')]);

        Sanctum::actingAs($admin);

        $this->getJson('/api/orbit/workspaces')
            ->assertForbidden()
            ->assertJsonFragment(['module' => 'orbit']);
    }

    public function test_organization_admin_can_create_a_workspace_and_becomes_its_admin_member(): void
    {
        $fixture = $this->createOrbitOrganization();
        Sanctum::actingAs($fixture['admin']);

        $response = $this->postJson('/api/orbit/workspaces', [
            'name' => 'Product & Engineering',
            'visibility' => 'organization',
        ])->assertCreated();

        $workspaceId = $response->json('workspace.id');

        $this->assertDatabaseHas('orbit_workspace_members', [
            'workspace_id' => $workspaceId,
            'user_id' => $fixture['admin']->id,
            'role' => 'admin',
        ]);
    }

    public function test_plain_employee_without_orbit_permissions_cannot_create_a_workspace(): void
    {
        $fixture = $this->createOrbitOrganization();
        Sanctum::actingAs($fixture['employee']);

        $this->postJson('/api/orbit/workspaces', ['name' => 'Should Fail'])
            ->assertForbidden();
    }

    public function test_duplicate_project_key_prefix_in_the_same_organization_is_rejected(): void
    {
        $fixture = $this->createOrbitOrganization();
        Sanctum::actingAs($fixture['admin']);

        $workspace = OrbitWorkspace::create(['organization_id' => $fixture['organization']->id, 'name' => 'Eng', 'slug' => 'eng', 'owner_id' => $fixture['admin']->id]);

        $this->postJson("/api/orbit/workspaces/{$workspace->id}/projects", [
            'name' => 'Mobile Redesign', 'key_prefix' => 'MOBI', 'mode' => 'kanban',
        ])->assertCreated();

        $this->postJson("/api/orbit/workspaces/{$workspace->id}/projects", [
            'name' => 'Mobile Platform', 'key_prefix' => 'MOBI', 'mode' => 'kanban',
        ])->assertStatus(422);
    }

    public function test_private_workspace_is_invisible_to_a_non_member(): void
    {
        $fixture = $this->createOrbitOrganization();

        $workspace = OrbitWorkspace::create([
            'organization_id' => $fixture['organization']->id, 'name' => 'Exec Office', 'slug' => 'exec-office',
            'visibility' => 'private', 'owner_id' => $fixture['admin']->id,
        ]);
        OrbitWorkspaceMember::create(['organization_id' => $fixture['organization']->id, 'workspace_id' => $workspace->id, 'user_id' => $fixture['admin']->id, 'role' => 'admin']);

        // Give the employee the module-access permission so this is testing
        // visibility, not the coarser module gate.
        $fixture['roles']->get('employee')->givePermissionTo('orbit.access');
        Sanctum::actingAs($fixture['employee']);

        $this->getJson("/api/orbit/workspaces/{$workspace->id}")->assertNotFound();
    }

    public function test_a_workspace_from_another_organization_is_not_found_not_forbidden(): void
    {
        $fixtureA = $this->createOrbitOrganization('ORBITA');
        $fixtureB = $this->createOrbitOrganization('ORBITB');

        $workspaceB = OrbitWorkspace::create(['organization_id' => $fixtureB['organization']->id, 'name' => 'Org B Workspace', 'slug' => 'org-b', 'owner_id' => $fixtureB['admin']->id]);

        Sanctum::actingAs($fixtureA['admin']);

        $this->getJson("/api/orbit/workspaces/{$workspaceB->id}")->assertNotFound();
    }

    public function test_removing_the_last_workspace_administrator_is_blocked(): void
    {
        $fixture = $this->createOrbitOrganization();
        Sanctum::actingAs($fixture['admin']);

        $workspace = OrbitWorkspace::create(['organization_id' => $fixture['organization']->id, 'name' => 'Solo Admin WS', 'slug' => 'solo-admin', 'owner_id' => $fixture['admin']->id]);
        OrbitWorkspaceMember::create(['organization_id' => $fixture['organization']->id, 'workspace_id' => $workspace->id, 'user_id' => $fixture['admin']->id, 'role' => 'admin']);

        $this->deleteJson("/api/orbit/workspaces/{$workspace->id}/members/{$fixture['admin']->id}")
            ->assertStatus(422);
    }

    public function test_archiving_a_workspace_cascades_to_its_active_projects(): void
    {
        $fixture = $this->createOrbitOrganization();
        Sanctum::actingAs($fixture['admin']);

        $workspace = OrbitWorkspace::create(['organization_id' => $fixture['organization']->id, 'name' => 'Cascading', 'slug' => 'cascading', 'owner_id' => $fixture['admin']->id]);
        OrbitWorkspaceMember::create(['organization_id' => $fixture['organization']->id, 'workspace_id' => $workspace->id, 'user_id' => $fixture['admin']->id, 'role' => 'admin']);
        $project = OrbitProject::create(['organization_id' => $fixture['organization']->id, 'workspace_id' => $workspace->id, 'name' => 'P1', 'key_prefix' => 'CASC', 'mode' => 'kanban']);

        $this->postJson("/api/orbit/workspaces/{$workspace->id}/archive")->assertOk();

        $this->assertNotNull($project->fresh()->archived_at);
    }
}
