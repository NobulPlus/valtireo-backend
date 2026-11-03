<?php

namespace Tests\Feature\Orbit;

use App\Models\Employee;
use App\Models\OrbitProject;
use App\Models\OrbitProjectMember;
use App\Models\OrbitWorkItem;
use App\Models\OrbitWorkspace;
use App\Models\Ticket;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * The sharpest permission rule in Orbit: seeing a link must never grant
 * access to the linked record (docs/orbit/06 §7). These tests verify the
 * label itself — not just the record — is withheld when the viewer lacks
 * permission, and that cross-organization linking is impossible.
 */
class OrbitWorkItemLinkTest extends TestCase
{
    use RefreshDatabase, SetsUpOrbitOrganization;

    private function projectWithItem(array $fixture): array
    {
        $workspace = OrbitWorkspace::create(['organization_id' => $fixture['organization']->id, 'name' => 'WS', 'slug' => 'ws', 'owner_id' => $fixture['admin']->id]);
        $project = OrbitProject::create(['organization_id' => $fixture['organization']->id, 'workspace_id' => $workspace->id, 'name' => 'Project', 'key_prefix' => 'LINK', 'mode' => 'kanban']);
        $status = \App\Models\OrbitStatus::create(['project_id' => $project->id, 'name' => 'To Do', 'category' => 'todo', 'position' => 1, 'is_default' => true]);
        OrbitProjectMember::create(['organization_id' => $fixture['organization']->id, 'project_id' => $project->id, 'user_id' => $fixture['admin']->id, 'role' => 'admin']);

        $item = OrbitWorkItem::create([
            'organization_id' => $fixture['organization']->id, 'project_id' => $project->id, 'key' => 'LINK-1',
            'type' => 'task', 'title' => 'Fix the thing', 'status_id' => $status->id, 'reporter_id' => $fixture['admin']->id, 'position' => 1,
        ]);

        return ['project' => $project, 'item' => $item];
    }

    public function test_a_viewer_without_ticket_permission_sees_no_label_and_no_access(): void
    {
        $fixture = $this->createOrbitOrganization();
        ['project' => $project, 'item' => $item] = $this->projectWithItem($fixture);

        $ticketOwner = Employee::factory()->create(['organization_id' => $fixture['organization']->id, 'status' => 'active']);
        $ticket = Ticket::create([
            'organization_id' => $fixture['organization']->id, 'employee_id' => $ticketOwner->id,
            'category' => 'it', 'subject' => 'VPN access broken', 'description' => 'Cannot connect.',
        ]);

        Sanctum::actingAs($fixture['admin']);
        $this->postJson("/api/orbit/work-items/{$item->key}/links", ['linked_type' => 'ticket', 'linked_id' => $ticket->id])->assertCreated();

        $viewer = User::create(['organization_id' => $fixture['organization']->id, 'name' => 'Nosy Viewer', 'email' => 'nosy@test.local', 'password' => 'Password1!']);
        $viewer->syncRoles([$fixture['roles']->get('employee')]);
        $fixture['roles']->get('employee')->givePermissionTo('orbit.access');
        OrbitProjectMember::create(['organization_id' => $fixture['organization']->id, 'project_id' => $project->id, 'user_id' => $viewer->id, 'role' => 'viewer']);

        Sanctum::actingAs($viewer);
        $response = $this->getJson("/api/orbit/work-items/{$item->key}/links")->assertOk();

        $this->assertFalse($response->json('data.0.viewer_can_access'));
        $this->assertNull($response->json('data.0.label'));
    }

    public function test_the_tickets_own_owner_can_see_the_label_without_the_view_permission(): void
    {
        $fixture = $this->createOrbitOrganization();
        ['project' => $project, 'item' => $item] = $this->projectWithItem($fixture);

        $ticketOwnerUser = User::create(['organization_id' => $fixture['organization']->id, 'name' => 'Owner', 'email' => 'owner@test.local', 'password' => 'Password1!']);
        $ticketOwnerUser->syncRoles([$fixture['roles']->get('employee')]);
        $fixture['roles']->get('employee')->givePermissionTo('orbit.access');
        $ticketOwnerEmployee = Employee::factory()->create(['organization_id' => $fixture['organization']->id, 'user_id' => $ticketOwnerUser->id, 'status' => 'active']);

        $ticket = Ticket::create([
            'organization_id' => $fixture['organization']->id, 'employee_id' => $ticketOwnerEmployee->id,
            'category' => 'it', 'subject' => 'My own ticket', 'description' => 'Something broke.',
        ]);

        Sanctum::actingAs($fixture['admin']);
        $this->postJson("/api/orbit/work-items/{$item->key}/links", ['linked_type' => 'ticket', 'linked_id' => $ticket->id])->assertCreated();

        OrbitProjectMember::create(['organization_id' => $fixture['organization']->id, 'project_id' => $project->id, 'user_id' => $ticketOwnerUser->id, 'role' => 'viewer']);

        Sanctum::actingAs($ticketOwnerUser);
        $response = $this->getJson("/api/orbit/work-items/{$item->key}/links")->assertOk();

        $this->assertTrue($response->json('data.0.viewer_can_access'));
        $this->assertSame('My own ticket', $response->json('data.0.label'));
    }

    public function test_linking_to_a_record_in_a_different_organization_is_rejected(): void
    {
        $fixtureA = $this->createOrbitOrganization('ORBITA');
        $fixtureB = $this->createOrbitOrganization('ORBITB');
        ['item' => $itemA] = $this->projectWithItem($fixtureA);

        $employeeB = Employee::factory()->create(['organization_id' => $fixtureB['organization']->id, 'status' => 'active']);
        $ticketB = Ticket::create([
            'organization_id' => $fixtureB['organization']->id, 'employee_id' => $employeeB->id,
            'category' => 'it', 'subject' => 'Org B ticket', 'description' => 'Not yours.',
        ]);

        Sanctum::actingAs($fixtureA['admin']);

        $this->postJson("/api/orbit/work-items/{$itemA->key}/links", ['linked_type' => 'ticket', 'linked_id' => $ticketB->id])
            ->assertStatus(422);
    }
}
