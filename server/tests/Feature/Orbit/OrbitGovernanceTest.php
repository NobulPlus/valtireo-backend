<?php

namespace Tests\Feature\Orbit;

use App\Models\OrbitLabel;
use App\Models\OrbitProject;
use App\Models\OrbitProjectMember;
use App\Models\OrbitStatus;
use App\Models\OrbitWorkItem;
use App\Models\OrbitWorkspace;
use App\Models\OrbitWorkspaceMember;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class OrbitGovernanceTest extends TestCase
{
    use RefreshDatabase, SetsUpOrbitOrganization;

    private function workspaceFor(array $fixture, string $slug = 'ws'): OrbitWorkspace
    {
        $workspace = OrbitWorkspace::create(['organization_id' => $fixture['organization']->id, 'name' => 'WS', 'slug' => $slug, 'owner_id' => $fixture['admin']->id]);
        OrbitWorkspaceMember::create(['organization_id' => $fixture['organization']->id, 'workspace_id' => $workspace->id, 'user_id' => $fixture['admin']->id, 'role' => 'admin']);

        return $workspace;
    }

    private function projectFor(array $fixture, OrbitWorkspace $workspace, string $prefix = 'GOV'): OrbitProject
    {
        $project = OrbitProject::create(['organization_id' => $fixture['organization']->id, 'workspace_id' => $workspace->id, 'name' => 'Project', 'key_prefix' => $prefix, 'mode' => 'kanban']);
        OrbitStatus::create(['project_id' => $project->id, 'name' => 'To Do', 'category' => 'todo', 'position' => 1, 'is_default' => true]);
        OrbitProjectMember::create(['organization_id' => $fixture['organization']->id, 'project_id' => $project->id, 'user_id' => $fixture['admin']->id, 'role' => 'admin']);

        return $project;
    }

    public function test_a_user_without_orbit_access_is_blocked_from_every_orbit_route_even_in_a_subscribed_organization(): void
    {
        $fixture = $this->createOrbitOrganization();
        $this->workspaceFor($fixture);

        // The employee fixture role is deliberately NOT given orbit.access here —
        // the organization is subscribed to Orbit, but this user's role isn't.
        Sanctum::actingAs($fixture['employee']);

        $this->getJson('/api/orbit/workspaces')->assertForbidden();
    }

    public function test_granting_orbit_access_is_sufficient_to_view_an_organization_visibility_workspace(): void
    {
        $fixture = $this->createOrbitOrganization();
        $workspace = $this->workspaceFor($fixture, 'ws-org-visible');
        $fixture['roles']->get('employee')->givePermissionTo('orbit.access');

        Sanctum::actingAs($fixture['employee']);

        $this->getJson("/api/orbit/workspaces/{$workspace->id}")->assertOk();
    }

    public function test_workspace_show_reports_the_viewers_own_role_and_administer_flag(): void
    {
        $fixture = $this->createOrbitOrganization();
        $workspace = $this->workspaceFor($fixture);
        Sanctum::actingAs($fixture['admin']);

        $this->getJson("/api/orbit/workspaces/{$workspace->id}")
            ->assertOk()
            ->assertJsonFragment(['viewer_role' => 'admin', 'can_administer' => true]);
    }

    public function test_project_members_endpoint_reports_each_members_role(): void
    {
        $fixture = $this->createOrbitOrganization();
        $workspace = $this->workspaceFor($fixture, 'ws-members');
        $project = $this->projectFor($fixture, $workspace);

        $contributor = User::create(['organization_id' => $fixture['organization']->id, 'name' => 'Contributor', 'email' => 'contributor@test.local', 'password' => 'Password1!']);
        OrbitProjectMember::create(['organization_id' => $fixture['organization']->id, 'project_id' => $project->id, 'user_id' => $contributor->id, 'role' => 'contributor']);

        Sanctum::actingAs($fixture['admin']);

        $this->getJson("/api/orbit/projects/{$project->id}/members")
            ->assertOk()
            ->assertJsonFragment(['id' => $contributor->id, 'role' => 'contributor']);
    }

    public function test_project_members_endpoint_lists_most_recently_added_first(): void
    {
        $fixture = $this->createOrbitOrganization();
        $workspace = $this->workspaceFor($fixture, 'ws-members-order');
        $project = $this->projectFor($fixture, $workspace, 'ORDR');

        // created_at isn't fillable on OrbitProjectMember (by design — see its
        // #[Fillable] attribute), and Eloquent's own auto-timestamping would
        // otherwise stamp every row created in this test with the same
        // second anyway, so distinct timestamps have to be forced via a
        // direct update after create().
        $older = User::create(['organization_id' => $fixture['organization']->id, 'name' => 'Older Member', 'email' => 'older@test.local', 'password' => 'Password1!']);
        $olderMembership = OrbitProjectMember::create(['organization_id' => $fixture['organization']->id, 'project_id' => $project->id, 'user_id' => $older->id, 'role' => 'contributor']);
        $olderMembership->forceFill(['created_at' => now()->subDay()])->save();

        $newer = User::create(['organization_id' => $fixture['organization']->id, 'name' => 'Newer Member', 'email' => 'newer@test.local', 'password' => 'Password1!']);
        OrbitProjectMember::create(['organization_id' => $fixture['organization']->id, 'project_id' => $project->id, 'user_id' => $newer->id, 'role' => 'contributor']);

        Sanctum::actingAs($fixture['admin']);

        // Three members end up in the list (the admin from projectFor() plus these
        // two), so assert relative order rather than exact positions — the admin's
        // own created_at isn't controlled by this test.
        $ids = collect($this->getJson("/api/orbit/projects/{$project->id}/members")->assertOk()->json('data'))->pluck('id');

        $this->assertLessThan($ids->search($older->id), $ids->search($newer->id));
    }

    public function test_removing_a_project_member_immediately_revokes_their_access_to_a_private_project(): void
    {
        $fixture = $this->createOrbitOrganization();
        $workspace = $this->workspaceFor($fixture, 'ws-revoke');
        $project = $this->projectFor($fixture, $workspace, 'REVK');
        $project->update(['visibility' => 'private']);

        $member = User::create(['organization_id' => $fixture['organization']->id, 'name' => 'Member', 'email' => 'member@test.local', 'password' => 'Password1!']);
        $member->syncRoles([$fixture['roles']->get('employee')]);
        $fixture['roles']->get('employee')->givePermissionTo('orbit.access');
        OrbitProjectMember::create(['organization_id' => $fixture['organization']->id, 'project_id' => $project->id, 'user_id' => $member->id, 'role' => 'contributor']);

        Sanctum::actingAs($member);
        $this->getJson("/api/orbit/projects/{$project->id}")->assertOk();

        Sanctum::actingAs($fixture['admin']);
        $this->deleteJson("/api/orbit/projects/{$project->id}/members/{$member->id}")->assertOk();

        Sanctum::actingAs($member);
        $this->getJson("/api/orbit/projects/{$project->id}")->assertNotFound();
    }

    public function test_removing_the_last_project_administrator_is_blocked(): void
    {
        $fixture = $this->createOrbitOrganization();
        $workspace = $this->workspaceFor($fixture, 'ws-lastadmin');
        $project = $this->projectFor($fixture, $workspace, 'LAST');
        Sanctum::actingAs($fixture['admin']);

        $this->deleteJson("/api/orbit/projects/{$project->id}/members/{$fixture['admin']->id}")
            ->assertStatus(422);
    }

    public function test_a_contributor_cannot_manage_project_membership(): void
    {
        $fixture = $this->createOrbitOrganization();
        $workspace = $this->workspaceFor($fixture, 'ws-contrib');
        $project = $this->projectFor($fixture, $workspace, 'CTRB');

        $contributor = User::create(['organization_id' => $fixture['organization']->id, 'name' => 'Contributor', 'email' => 'contrib2@test.local', 'password' => 'Password1!']);
        $contributor->syncRoles([$fixture['roles']->get('employee')]);
        $fixture['roles']->get('employee')->givePermissionTo('orbit.access');
        OrbitProjectMember::create(['organization_id' => $fixture['organization']->id, 'project_id' => $project->id, 'user_id' => $contributor->id, 'role' => 'contributor']);

        Sanctum::actingAs($contributor);

        $this->postJson("/api/orbit/projects/{$project->id}/members", ['user_id' => $fixture['employee']->id])->assertForbidden();
    }

    public function test_archiving_and_restoring_a_project_round_trips(): void
    {
        $fixture = $this->createOrbitOrganization();
        $workspace = $this->workspaceFor($fixture, 'ws-archive');
        $project = $this->projectFor($fixture, $workspace, 'ARCH');
        Sanctum::actingAs($fixture['admin']);

        $this->postJson("/api/orbit/projects/{$project->id}/archive")->assertOk();
        $this->assertNotNull($project->fresh()->archived_at);

        $this->postJson("/api/orbit/projects/{$project->id}/restore")->assertOk();
        $this->assertNull($project->fresh()->archived_at);
    }

    public function test_a_project_contributor_cannot_archive_or_restore_the_project(): void
    {
        $fixture = $this->createOrbitOrganization();
        $workspace = $this->workspaceFor($fixture, 'ws-archive2');
        $project = $this->projectFor($fixture, $workspace, 'ARC2');

        $contributor = User::create(['organization_id' => $fixture['organization']->id, 'name' => 'Contributor', 'email' => 'contrib3@test.local', 'password' => 'Password1!']);
        $contributor->syncRoles([$fixture['roles']->get('employee')]);
        $fixture['roles']->get('employee')->givePermissionTo('orbit.access');
        OrbitProjectMember::create(['organization_id' => $fixture['organization']->id, 'project_id' => $project->id, 'user_id' => $contributor->id, 'role' => 'contributor']);

        Sanctum::actingAs($contributor);

        $this->postJson("/api/orbit/projects/{$project->id}/archive")->assertForbidden();
    }

    public function test_project_admin_can_create_update_and_delete_a_status_column(): void
    {
        $fixture = $this->createOrbitOrganization();
        $workspace = $this->workspaceFor($fixture, 'ws-status');
        $project = $this->projectFor($fixture, $workspace, 'STA1');
        Sanctum::actingAs($fixture['admin']);

        $response = $this->postJson("/api/orbit/projects/{$project->id}/statuses", ['name' => 'In Review', 'category' => 'in_progress'])
            ->assertCreated();
        $statusId = $response->json('status.id');

        $this->patchJson("/api/orbit/projects/{$project->id}/statuses/{$statusId}", ['name' => 'In Peer Review'])
            ->assertOk()
            ->assertJsonFragment(['name' => 'In Peer Review']);

        $this->deleteJson("/api/orbit/projects/{$project->id}/statuses/{$statusId}")->assertOk();
        $this->assertDatabaseMissing('orbit_statuses', ['id' => $statusId]);
    }

    public function test_a_status_column_with_work_items_on_it_cannot_be_deleted(): void
    {
        $fixture = $this->createOrbitOrganization();
        $workspace = $this->workspaceFor($fixture, 'ws-status2');
        $project = $this->projectFor($fixture, $workspace, 'STA2');
        Sanctum::actingAs($fixture['admin']);

        $status = $project->statuses()->first();
        OrbitWorkItem::create([
            'organization_id' => $fixture['organization']->id, 'project_id' => $project->id, 'key' => "{$project->key_prefix}-1",
            'type' => 'task', 'title' => 'Occupying this column', 'status_id' => $status->id, 'reporter_id' => $fixture['admin']->id, 'position' => 1,
        ]);

        $this->deleteJson("/api/orbit/projects/{$project->id}/statuses/{$status->id}")->assertStatus(422);
    }

    public function test_a_project_contributor_cannot_create_a_status_column(): void
    {
        $fixture = $this->createOrbitOrganization();
        $workspace = $this->workspaceFor($fixture, 'ws-status3');
        $project = $this->projectFor($fixture, $workspace, 'STA3');

        $contributor = User::create(['organization_id' => $fixture['organization']->id, 'name' => 'Contributor', 'email' => 'contrib5@test.local', 'password' => 'Password1!']);
        $contributor->syncRoles([$fixture['roles']->get('employee')]);
        $fixture['roles']->get('employee')->givePermissionTo('orbit.access');
        OrbitProjectMember::create(['organization_id' => $fixture['organization']->id, 'project_id' => $project->id, 'user_id' => $contributor->id, 'role' => 'contributor']);

        Sanctum::actingAs($contributor);

        $this->postJson("/api/orbit/projects/{$project->id}/statuses", ['name' => 'Nope', 'category' => 'todo'])
            ->assertForbidden();
    }

    public function test_project_admin_can_create_rename_and_delete_a_label(): void
    {
        $fixture = $this->createOrbitOrganization();
        $workspace = $this->workspaceFor($fixture, 'ws-labels');
        $project = $this->projectFor($fixture, $workspace, 'LBL1');
        Sanctum::actingAs($fixture['admin']);

        $response = $this->postJson("/api/orbit/projects/{$project->id}/labels", ['name' => 'Urgent', 'color' => '#ff0000'])
            ->assertCreated();
        $labelId = $response->json('label.id');

        $this->patchJson("/api/orbit/projects/{$project->id}/labels/{$labelId}", ['name' => 'Critical'])
            ->assertOk()
            ->assertJsonFragment(['name' => 'Critical']);

        $this->deleteJson("/api/orbit/projects/{$project->id}/labels/{$labelId}")->assertOk();
        $this->assertDatabaseMissing('orbit_labels', ['id' => $labelId]);
    }

    public function test_duplicate_label_name_in_the_same_project_is_rejected(): void
    {
        $fixture = $this->createOrbitOrganization();
        $workspace = $this->workspaceFor($fixture, 'ws-labeldup');
        $project = $this->projectFor($fixture, $workspace, 'LBL2');
        Sanctum::actingAs($fixture['admin']);

        OrbitLabel::create(['project_id' => $project->id, 'name' => 'Bug', 'color' => '#ff0000']);

        $this->postJson("/api/orbit/projects/{$project->id}/labels", ['name' => 'Bug', 'color' => '#00ff00'])
            ->assertStatus(422);
    }

    public function test_a_project_contributor_cannot_create_a_label(): void
    {
        $fixture = $this->createOrbitOrganization();
        $workspace = $this->workspaceFor($fixture, 'ws-labelperm');
        $project = $this->projectFor($fixture, $workspace, 'LBL3');

        $contributor = User::create(['organization_id' => $fixture['organization']->id, 'name' => 'Contributor', 'email' => 'contrib4@test.local', 'password' => 'Password1!']);
        $contributor->syncRoles([$fixture['roles']->get('employee')]);
        $fixture['roles']->get('employee')->givePermissionTo('orbit.access');
        OrbitProjectMember::create(['organization_id' => $fixture['organization']->id, 'project_id' => $project->id, 'user_id' => $contributor->id, 'role' => 'contributor']);

        Sanctum::actingAs($contributor);

        $this->postJson("/api/orbit/projects/{$project->id}/labels", ['name' => 'Nope', 'color' => '#000000'])
            ->assertForbidden();
    }

    public function test_a_label_cannot_be_modified_through_a_different_project(): void
    {
        $fixture = $this->createOrbitOrganization();
        $workspace = $this->workspaceFor($fixture, 'ws-labelcross');
        $projectA = $this->projectFor($fixture, $workspace, 'LBLA');
        $projectB = $this->projectFor($fixture, $workspace, 'LBLB');
        Sanctum::actingAs($fixture['admin']);

        $label = OrbitLabel::create(['project_id' => $projectA->id, 'name' => 'A-only', 'color' => '#ff0000']);

        $this->patchJson("/api/orbit/projects/{$projectB->id}/labels/{$label->id}", ['name' => 'Hijacked'])
            ->assertNotFound();
    }

    public function test_people_search_only_returns_colleagues_in_the_same_organization(): void
    {
        $fixtureA = $this->createOrbitOrganization('GOVA');
        $fixtureB = $this->createOrbitOrganization('GOVB');

        Sanctum::actingAs($fixtureA['admin']);

        $response = $this->getJson('/api/orbit/people?search='.urlencode($fixtureB['employee']->name))->assertOk();

        $this->assertEmpty($response->json('data'));
    }

    public function test_people_search_excludes_the_requesting_user(): void
    {
        $fixture = $this->createOrbitOrganization();
        Sanctum::actingAs($fixture['admin']);

        $response = $this->getJson('/api/orbit/people')->assertOk();

        $ids = collect($response->json('data'))->pluck('id');
        $this->assertFalse($ids->contains($fixture['admin']->id));
    }

    public function test_reordering_within_the_same_column_records_a_reordered_activity_without_a_notification(): void
    {
        $fixture = $this->createOrbitOrganization();
        $workspace = $this->workspaceFor($fixture, 'ws-reorder');
        $project = $this->projectFor($fixture, $workspace, 'ROR');
        Sanctum::actingAs($fixture['admin']);

        $status = $project->statuses()->first();
        $item = OrbitWorkItem::create([
            'organization_id' => $fixture['organization']->id, 'project_id' => $project->id, 'key' => "{$project->key_prefix}-1",
            'type' => 'task', 'title' => 'Reorder me', 'status_id' => $status->id, 'reporter_id' => $fixture['admin']->id, 'position' => 1,
        ]);

        $this->postJson("/api/orbit/work-items/{$item->key}/move", [
            'status_id' => $status->id, 'position' => '2048.0000000000', 'version' => 1,
        ])->assertOk();

        $this->assertDatabaseHas('orbit_work_item_activities', [
            'work_item_id' => $item->id,
            'event' => 'reordered',
        ]);

        $this->assertDatabaseMissing('notifications', ['notifiable_id' => $fixture['admin']->id]);
    }

    public function test_moving_with_a_stale_version_is_rejected_and_position_is_unchanged(): void
    {
        $fixture = $this->createOrbitOrganization();
        $workspace = $this->workspaceFor($fixture, 'ws-stalemove');
        $project = $this->projectFor($fixture, $workspace, 'STAL');
        Sanctum::actingAs($fixture['admin']);

        $status = $project->statuses()->first();
        $item = OrbitWorkItem::create([
            'organization_id' => $fixture['organization']->id, 'project_id' => $project->id, 'key' => "{$project->key_prefix}-1",
            'type' => 'task', 'title' => 'Stale move', 'status_id' => $status->id, 'reporter_id' => $fixture['admin']->id, 'position' => 1,
        ]);

        $this->postJson("/api/orbit/work-items/{$item->key}/move", [
            'status_id' => $status->id, 'position' => '2048.0000000000', 'version' => 1,
        ])->assertOk();

        $this->postJson("/api/orbit/work-items/{$item->key}/move", [
            'status_id' => $status->id, 'position' => '4096.0000000000', 'version' => 1,
        ])->assertStatus(409);

        $this->assertEquals('2048.0000000000', $item->fresh()->position);
    }
}
