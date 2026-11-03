<?php

namespace Tests\Feature\Orbit;

use App\Models\OrbitProject;
use App\Models\OrbitProjectMember;
use App\Models\OrbitWorkItem;
use App\Models\OrbitWorkspace;
use App\Services\OrbitWorkItemKeyGenerator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class OrbitWorkItemTest extends TestCase
{
    use RefreshDatabase, SetsUpOrbitOrganization;

    private function projectFor(array $fixture, string $prefix = 'PROJ'): OrbitProject
    {
        $workspace = OrbitWorkspace::create(['organization_id' => $fixture['organization']->id, 'name' => 'WS', 'slug' => 'ws-'.strtolower($prefix), 'owner_id' => $fixture['admin']->id]);
        $project = OrbitProject::create(['organization_id' => $fixture['organization']->id, 'workspace_id' => $workspace->id, 'name' => 'Project', 'key_prefix' => $prefix, 'mode' => 'kanban']);
        \App\Models\OrbitStatus::create(['project_id' => $project->id, 'name' => 'To Do', 'category' => 'todo', 'position' => 1, 'is_default' => true]);
        \App\Models\OrbitStatus::create(['project_id' => $project->id, 'name' => 'Done', 'category' => 'done', 'position' => 2]);
        OrbitProjectMember::create(['organization_id' => $fixture['organization']->id, 'project_id' => $project->id, 'user_id' => $fixture['admin']->id, 'role' => 'admin']);

        return $project;
    }

    public function test_creating_a_work_item_assigns_a_sequential_key_and_the_default_column(): void
    {
        $fixture = $this->createOrbitOrganization();
        $project = $this->projectFor($fixture);
        Sanctum::actingAs($fixture['admin']);

        $response = $this->postJson("/api/orbit/projects/{$project->id}/work-items", [
            'type' => 'task', 'title' => 'Set up CI pipeline',
        ])->assertCreated();

        $this->assertSame("{$project->key_prefix}-1", $response->json('work_item.key'));
        $this->assertSame('To Do', $response->json('work_item.status.name'));
    }

    public function test_two_items_created_back_to_back_never_collide_on_key(): void
    {
        $fixture = $this->createOrbitOrganization();
        $project = $this->projectFor($fixture);

        $generator = app(OrbitWorkItemKeyGenerator::class);
        $keys = [$generator->next($project), $generator->next($project), $generator->next($project)];

        $this->assertSame(array_unique($keys), $keys);
        $this->assertSame(["{$project->key_prefix}-1", "{$project->key_prefix}-2", "{$project->key_prefix}-3"], $keys);
    }

    public function test_updating_a_work_item_with_a_stale_version_is_rejected(): void
    {
        $fixture = $this->createOrbitOrganization();
        $project = $this->projectFor($fixture);
        Sanctum::actingAs($fixture['admin']);

        $status = $project->statuses()->first();
        $item = OrbitWorkItem::create([
            'organization_id' => $fixture['organization']->id, 'project_id' => $project->id, 'key' => "{$project->key_prefix}-1",
            'type' => 'task', 'title' => 'Original title', 'status_id' => $status->id, 'reporter_id' => $fixture['admin']->id,
            'position' => 1,
        ]);

        $this->patchJson("/api/orbit/work-items/{$item->key}", ['version' => 1, 'title' => 'First edit'])->assertOk();

        // Same stale version again — must now conflict.
        $this->patchJson("/api/orbit/work-items/{$item->key}", ['version' => 1, 'title' => 'Conflicting edit'])
            ->assertStatus(409);

        $this->assertSame('First edit', $item->fresh()->title);
    }

    public function test_moving_a_work_item_records_an_activity_with_previous_and_new_status(): void
    {
        $fixture = $this->createOrbitOrganization();
        $project = $this->projectFor($fixture);
        Sanctum::actingAs($fixture['admin']);

        $todo = $project->statuses()->where('category', 'todo')->first();
        $done = $project->statuses()->where('category', 'done')->first();

        $item = OrbitWorkItem::create([
            'organization_id' => $fixture['organization']->id, 'project_id' => $project->id, 'key' => "{$project->key_prefix}-1",
            'type' => 'task', 'title' => 'Ship it', 'status_id' => $todo->id, 'reporter_id' => $fixture['admin']->id, 'position' => 1,
        ]);

        $this->postJson("/api/orbit/work-items/{$item->key}/move", [
            'status_id' => $done->id, 'position' => '2.0000000000', 'version' => 1,
        ])->assertOk();

        $this->assertDatabaseHas('orbit_work_item_activities', [
            'work_item_id' => $item->id,
            'event' => 'moved',
        ]);

        $activity = \App\Models\OrbitWorkItemActivity::where('work_item_id', $item->id)->where('event', 'moved')->first();
        $this->assertSame(['status_id' => $todo->id], $activity->from_value);
        $this->assertSame(['status_id' => $done->id], $activity->to_value);
        $this->assertNotNull($item->fresh()->completed_at);
    }

    public function test_a_viewer_cannot_move_or_edit_work_items(): void
    {
        $fixture = $this->createOrbitOrganization();
        $project = $this->projectFor($fixture);

        $viewer = \App\Models\User::create(['organization_id' => $fixture['organization']->id, 'name' => 'Viewer', 'email' => 'viewer@test.local', 'password' => 'Password1!']);
        $viewer->syncRoles([$fixture['roles']->get('employee')]);
        $fixture['roles']->get('employee')->givePermissionTo('orbit.access');
        OrbitProjectMember::create(['organization_id' => $fixture['organization']->id, 'project_id' => $project->id, 'user_id' => $viewer->id, 'role' => 'viewer']);

        $status = $project->statuses()->first();
        $item = OrbitWorkItem::create([
            'organization_id' => $fixture['organization']->id, 'project_id' => $project->id, 'key' => "{$project->key_prefix}-1",
            'type' => 'task', 'title' => 'Immutable to viewer', 'status_id' => $status->id, 'reporter_id' => $fixture['admin']->id, 'position' => 1,
        ]);

        Sanctum::actingAs($viewer);

        $this->patchJson("/api/orbit/work-items/{$item->key}", ['version' => 1, 'title' => 'Hacked'])->assertForbidden();
        $this->getJson("/api/orbit/work-items/{$item->key}")->assertOk();
    }
}
