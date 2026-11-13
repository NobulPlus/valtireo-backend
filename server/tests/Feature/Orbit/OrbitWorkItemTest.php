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

    private function projectFor(array $fixture, string $prefix = 'PROJ', string $mode = 'kanban'): OrbitProject
    {
        $workspace = OrbitWorkspace::create(['organization_id' => $fixture['organization']->id, 'name' => 'WS', 'slug' => 'ws-'.strtolower($prefix), 'owner_id' => $fixture['admin']->id]);
        $project = OrbitProject::create(['organization_id' => $fixture['organization']->id, 'workspace_id' => $workspace->id, 'name' => 'Project', 'key_prefix' => $prefix, 'mode' => $mode]);
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

    public function test_creating_a_work_item_with_an_estimate_on_a_kanban_project_is_rejected(): void
    {
        $fixture = $this->createOrbitOrganization();
        $project = $this->projectFor($fixture, 'KNBN', 'kanban');
        Sanctum::actingAs($fixture['admin']);

        $this->postJson("/api/orbit/projects/{$project->id}/work-items", [
            'type' => 'task', 'title' => 'Needs an estimate', 'estimate' => 5,
        ])->assertStatus(422);
    }

    public function test_creating_a_work_item_with_an_estimate_on_a_scrum_project_succeeds(): void
    {
        $fixture = $this->createOrbitOrganization();
        $project = $this->projectFor($fixture, 'SCRM', 'scrum');
        Sanctum::actingAs($fixture['admin']);

        $this->postJson("/api/orbit/projects/{$project->id}/work-items", [
            'type' => 'task', 'title' => 'Needs an estimate', 'estimate' => 5,
        ])->assertCreated();
    }

    public function test_creating_a_scrum_item_can_set_its_sprint_and_definition_of_done(): void
    {
        $fixture = $this->createOrbitOrganization();
        $project = $this->projectFor($fixture, 'SCRM', 'scrum');
        Sanctum::actingAs($fixture['admin']);

        $iteration = \App\Models\OrbitIteration::create([
            'project_id' => $project->id, 'name' => 'Sprint 1', 'starts_at' => '2026-01-01', 'ends_at' => '2026-01-14', 'status' => 'planned',
        ]);

        $this->postJson("/api/orbit/projects/{$project->id}/work-items", [
            'type' => 'story', 'title' => 'Plan the release', 'iteration_id' => $iteration->id,
            'definition_of_done' => 'Reviewed, tested, and accepted.', 'acceptance_criteria' => 'Given the plan, the team can deliver it.',
        ])->assertCreated()
            ->assertJsonPath('work_item.iteration_id', $iteration->id)
            ->assertJsonPath('work_item.definition_of_done', 'Reviewed, tested, and accepted.');
    }

    public function test_creating_an_item_in_a_completed_sprint_is_rejected(): void
    {
        $fixture = $this->createOrbitOrganization();
        $project = $this->projectFor($fixture, 'SCRM', 'scrum');
        Sanctum::actingAs($fixture['admin']);

        $iteration = \App\Models\OrbitIteration::create([
            'project_id' => $project->id, 'name' => 'Finished', 'starts_at' => '2026-01-01', 'ends_at' => '2026-01-14', 'status' => 'completed',
        ]);

        $this->postJson("/api/orbit/projects/{$project->id}/work-items", [
            'type' => 'task', 'title' => 'Too late', 'iteration_id' => $iteration->id,
        ])->assertStatus(422);
    }

    public function test_backlog_filters_return_only_unscheduled_top_level_items(): void
    {
        $fixture = $this->createOrbitOrganization();
        $project = $this->projectFor($fixture, 'SCRM', 'scrum');
        Sanctum::actingAs($fixture['admin']);
        $status = $project->statuses()->first();
        $iteration = \App\Models\OrbitIteration::create([
            'project_id' => $project->id, 'name' => 'Sprint 1', 'starts_at' => '2026-01-01', 'ends_at' => '2026-01-14', 'status' => 'planned',
        ]);

        $topLevel = OrbitWorkItem::create([
            'organization_id' => $fixture['organization']->id, 'project_id' => $project->id, 'key' => 'SCRM-1', 'type' => 'task', 'title' => 'Backlog item', 'status_id' => $status->id, 'reporter_id' => $fixture['admin']->id, 'position' => 1,
        ]);
        OrbitWorkItem::create([
            'organization_id' => $fixture['organization']->id, 'project_id' => $project->id, 'key' => 'SCRM-2', 'type' => 'subtask', 'title' => 'Child item', 'status_id' => $status->id, 'reporter_id' => $fixture['admin']->id, 'parent_id' => $topLevel->id, 'position' => 2,
        ]);
        OrbitWorkItem::create([
            'organization_id' => $fixture['organization']->id, 'project_id' => $project->id, 'key' => 'SCRM-3', 'type' => 'task', 'title' => 'Scheduled item', 'status_id' => $status->id, 'reporter_id' => $fixture['admin']->id, 'iteration_id' => $iteration->id, 'position' => 3,
        ]);

        $this->getJson("/api/orbit/projects/{$project->id}/work-items?iteration_id=none&parent_id=none")
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $topLevel->id);
    }

    public function test_items_created_back_to_back_get_increasing_backlog_ranks(): void
    {
        $fixture = $this->createOrbitOrganization();
        $project = $this->projectFor($fixture, 'SCRM', 'scrum');
        Sanctum::actingAs($fixture['admin']);

        $first = $this->postJson("/api/orbit/projects/{$project->id}/work-items", ['type' => 'task', 'title' => 'First'])->assertCreated();
        $second = $this->postJson("/api/orbit/projects/{$project->id}/work-items", ['type' => 'task', 'title' => 'Second'])->assertCreated();

        $this->assertGreaterThan((float) $first->json('work_item.backlog_rank'), (float) $second->json('work_item.backlog_rank'));
    }

    public function test_reordering_the_backlog_persists_and_is_reflected_in_index_ordering(): void
    {
        $fixture = $this->createOrbitOrganization();
        $project = $this->projectFor($fixture, 'SCRM', 'scrum');
        Sanctum::actingAs($fixture['admin']);
        $status = $project->statuses()->first();

        $first = OrbitWorkItem::create([
            'organization_id' => $fixture['organization']->id, 'project_id' => $project->id, 'key' => 'SCRM-1', 'type' => 'task', 'title' => 'First', 'status_id' => $status->id, 'reporter_id' => $fixture['admin']->id, 'position' => 1, 'backlog_rank' => 1024,
        ]);
        $second = OrbitWorkItem::create([
            'organization_id' => $fixture['organization']->id, 'project_id' => $project->id, 'key' => 'SCRM-2', 'type' => 'task', 'title' => 'Second', 'status_id' => $status->id, 'reporter_id' => $fixture['admin']->id, 'position' => 2, 'backlog_rank' => 2048,
        ]);

        // Move "Second" ahead of "First".
        $this->postJson("/api/orbit/work-items/{$second->key}/reorder-backlog", [
            'backlog_rank' => '512', 'version' => 1,
        ])->assertOk();

        $response = $this->getJson("/api/orbit/projects/{$project->id}/work-items?iteration_id=none&parent_id=none")->assertOk();
        $this->assertSame([$second->id, $first->id], $response->json('data.*.id'));
    }

    public function test_reordering_the_backlog_with_a_stale_version_is_rejected(): void
    {
        $fixture = $this->createOrbitOrganization();
        $project = $this->projectFor($fixture, 'SCRM', 'scrum');
        Sanctum::actingAs($fixture['admin']);
        $status = $project->statuses()->first();

        $item = OrbitWorkItem::create([
            'organization_id' => $fixture['organization']->id, 'project_id' => $project->id, 'key' => 'SCRM-1', 'type' => 'task', 'title' => 'First', 'status_id' => $status->id, 'reporter_id' => $fixture['admin']->id, 'position' => 1, 'backlog_rank' => 1024,
        ]);

        $this->postJson("/api/orbit/work-items/{$item->key}/reorder-backlog", [
            'backlog_rank' => '512', 'version' => 0,
        ])->assertStatus(409);
    }

    public function test_iterations_cannot_be_set_on_a_non_scrum_project(): void
    {
        $fixture = $this->createOrbitOrganization();
        $project = $this->projectFor($fixture, 'KNBN', 'kanban');
        Sanctum::actingAs($fixture['admin']);

        $this->postJson("/api/orbit/projects/{$project->id}/work-items", [
            'type' => 'task', 'title' => 'No sprint here', 'iteration_id' => 1,
        ])->assertStatus(422);
    }

    public function test_updating_a_work_item_with_acceptance_criteria_on_a_kanban_project_is_rejected(): void
    {
        $fixture = $this->createOrbitOrganization();
        $project = $this->projectFor($fixture, 'KNBN', 'kanban');
        Sanctum::actingAs($fixture['admin']);

        $status = $project->statuses()->first();
        $item = OrbitWorkItem::create([
            'organization_id' => $fixture['organization']->id, 'project_id' => $project->id, 'key' => "{$project->key_prefix}-1",
            'type' => 'task', 'title' => 'A kanban task', 'status_id' => $status->id, 'reporter_id' => $fixture['admin']->id,
            'position' => 1,
        ]);

        $this->patchJson("/api/orbit/work-items/{$item->key}", [
            'version' => 1, 'acceptance_criteria' => 'Given/When/Then',
        ])->assertStatus(422);
    }

    public function test_assigning_a_work_item_to_a_completed_sprint_is_rejected(): void
    {
        $fixture = $this->createOrbitOrganization();
        $project = $this->projectFor($fixture, 'SCRM', 'scrum');
        Sanctum::actingAs($fixture['admin']);

        $status = $project->statuses()->first();
        $item = OrbitWorkItem::create([
            'organization_id' => $fixture['organization']->id, 'project_id' => $project->id, 'key' => "{$project->key_prefix}-1",
            'type' => 'task', 'title' => 'Needs a sprint', 'status_id' => $status->id, 'reporter_id' => $fixture['admin']->id,
            'position' => 1,
        ]);

        $iteration = \App\Models\OrbitIteration::create([
            'project_id' => $project->id, 'name' => 'Sprint 1', 'starts_at' => '2026-01-01', 'ends_at' => '2026-01-14', 'status' => 'completed',
        ]);

        $this->patchJson("/api/orbit/work-items/{$item->key}", [
            'version' => 1, 'iteration_id' => $iteration->id,
        ])->assertStatus(422);
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

    public function test_viewing_a_work_item_includes_its_watchers_and_activity_history(): void
    {
        $fixture = $this->createOrbitOrganization();
        $project = $this->projectFor($fixture);
        Sanctum::actingAs($fixture['admin']);

        $response = $this->postJson("/api/orbit/projects/{$project->id}/work-items", [
            'type' => 'task', 'title' => 'Track this',
        ])->assertCreated();
        $key = $response->json('work_item.key');

        $show = $this->getJson("/api/orbit/work-items/{$key}")->assertOk();
        $this->assertSame([], $show->json('work_item.watchers'));
        $this->assertSame('created', $show->json('work_item.activities.0.event'));
    }

    public function test_a_user_can_watch_and_unwatch_a_work_item(): void
    {
        $fixture = $this->createOrbitOrganization();
        $project = $this->projectFor($fixture);
        Sanctum::actingAs($fixture['admin']);

        $response = $this->postJson("/api/orbit/projects/{$project->id}/work-items", [
            'type' => 'task', 'title' => 'Watch me',
        ])->assertCreated();
        $key = $response->json('work_item.key');

        $this->postJson("/api/orbit/work-items/{$key}/watch")->assertOk();
        $watching = $this->getJson("/api/orbit/work-items/{$key}")->assertOk();
        $this->assertSame([$fixture['admin']->id], collect($watching->json('work_item.watchers'))->pluck('id')->all());

        $this->deleteJson("/api/orbit/work-items/{$key}/watch")->assertOk();
        $unwatched = $this->getJson("/api/orbit/work-items/{$key}")->assertOk();
        $this->assertSame([], $unwatched->json('work_item.watchers'));
    }
}
