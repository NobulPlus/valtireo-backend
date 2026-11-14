<?php

namespace Tests\Feature\Orbit;

use App\Models\OrbitIteration;
use App\Models\OrbitProject;
use App\Models\OrbitProjectMember;
use App\Models\OrbitWorkItem;
use App\Models\OrbitWorkspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class OrbitIterationTest extends TestCase
{
    use RefreshDatabase, SetsUpOrbitOrganization;

    private function projectFor(array $fixture, string $prefix = 'PROJ', string $mode = 'scrum'): OrbitProject
    {
        $workspace = OrbitWorkspace::create(['organization_id' => $fixture['organization']->id, 'name' => 'WS', 'slug' => 'ws-'.strtolower($prefix), 'owner_id' => $fixture['admin']->id]);
        $project = OrbitProject::create(['organization_id' => $fixture['organization']->id, 'workspace_id' => $workspace->id, 'name' => 'Project', 'key_prefix' => $prefix, 'mode' => $mode]);
        \App\Models\OrbitStatus::create(['project_id' => $project->id, 'name' => 'To Do', 'category' => 'todo', 'position' => 1, 'is_default' => true]);
        \App\Models\OrbitStatus::create(['project_id' => $project->id, 'name' => 'Done', 'category' => 'done', 'position' => 2]);
        OrbitProjectMember::create(['organization_id' => $fixture['organization']->id, 'project_id' => $project->id, 'user_id' => $fixture['admin']->id, 'role' => 'admin']);
        OrbitProjectMember::create(['organization_id' => $fixture['organization']->id, 'project_id' => $project->id, 'user_id' => $fixture['employee']->id, 'role' => 'contributor']);

        return $project;
    }

    private function itemIn(OrbitProject $project, array $fixture, string $statusName): OrbitWorkItem
    {
        $status = $project->statuses()->where('name', $statusName)->firstOrFail();
        $number = $project->workItems()->count() + 1;

        return OrbitWorkItem::create([
            'organization_id' => $fixture['organization']->id, 'project_id' => $project->id, 'key' => "{$project->key_prefix}-{$number}",
            'type' => 'task', 'title' => "Item {$number}", 'status_id' => $status->id, 'reporter_id' => $fixture['admin']->id,
            'position' => $number,
        ]);
    }

    public function test_creating_a_sprint_on_a_kanban_project_is_rejected(): void
    {
        $fixture = $this->createOrbitOrganization();
        $project = $this->projectFor($fixture, 'KNBN', 'kanban');
        Sanctum::actingAs($fixture['admin']);

        $this->postJson("/api/orbit/projects/{$project->id}/iterations", [
            'name' => 'Sprint 1', 'starts_at' => '2026-12-01', 'ends_at' => '2026-12-14',
        ])->assertStatus(422);
    }

    public function test_project_admin_can_create_update_and_delete_a_planned_sprint(): void
    {
        $fixture = $this->createOrbitOrganization();
        $project = $this->projectFor($fixture);
        Sanctum::actingAs($fixture['admin']);

        $response = $this->postJson("/api/orbit/projects/{$project->id}/iterations", [
            'name' => 'Sprint 1', 'starts_at' => '2026-12-01', 'ends_at' => '2026-12-14',
        ])->assertCreated();

        $iterationId = $response->json('iteration.id');
        $this->assertSame('planned', $response->json('iteration.status'));

        $this->patchJson("/api/orbit/iterations/{$iterationId}", ['name' => 'Sprint One'])->assertOk()
            ->assertJsonPath('iteration.name', 'Sprint One');

        $this->deleteJson("/api/orbit/iterations/{$iterationId}")->assertOk();
        $this->assertDatabaseMissing('orbit_iterations', ['id' => $iterationId]);
    }

    public function test_a_sprint_can_be_created_and_updated_with_a_numeric_capacity(): void
    {
        $fixture = $this->createOrbitOrganization();
        $project = $this->projectFor($fixture);
        Sanctum::actingAs($fixture['admin']);

        $response = $this->postJson("/api/orbit/projects/{$project->id}/iterations", [
            'name' => 'Sprint 1', 'starts_at' => '2026-12-01', 'ends_at' => '2026-12-14', 'capacity_points' => 20,
        ])->assertCreated();
        $this->assertSame('20.00', $response->json('iteration.capacity_points'));

        $iterationId = $response->json('iteration.id');
        $this->patchJson("/api/orbit/iterations/{$iterationId}", ['capacity_points' => 15.5])->assertOk()
            ->assertJsonPath('iteration.capacity_points', '15.50');
    }

    public function test_a_negative_sprint_capacity_is_rejected(): void
    {
        $fixture = $this->createOrbitOrganization();
        $project = $this->projectFor($fixture);
        Sanctum::actingAs($fixture['admin']);

        $this->postJson("/api/orbit/projects/{$project->id}/iterations", [
            'name' => 'Sprint 1', 'starts_at' => '2026-12-01', 'ends_at' => '2026-12-14', 'capacity_points' => -5,
        ])->assertStatus(422);
    }

    public function test_a_contributor_cannot_create_update_or_delete_a_sprint(): void
    {
        $fixture = $this->createOrbitOrganization();
        $fixture['roles']->get('employee')->givePermissionTo('orbit.access');
        $project = $this->projectFor($fixture);
        $iteration = OrbitIteration::create(['project_id' => $project->id, 'name' => 'Sprint 1', 'starts_at' => '2026-12-01', 'ends_at' => '2026-12-14', 'status' => 'planned']);
        Sanctum::actingAs($fixture['employee']);

        $this->postJson("/api/orbit/projects/{$project->id}/iterations", ['name' => 'Nope', 'starts_at' => '2026-12-01', 'ends_at' => '2026-12-14'])->assertForbidden();
        $this->patchJson("/api/orbit/iterations/{$iteration->id}", ['name' => 'Nope'])->assertForbidden();
        $this->deleteJson("/api/orbit/iterations/{$iteration->id}")->assertForbidden();
    }

    public function test_a_sprint_ending_before_it_starts_is_rejected(): void
    {
        $fixture = $this->createOrbitOrganization();
        $project = $this->projectFor($fixture);
        Sanctum::actingAs($fixture['admin']);

        $this->postJson("/api/orbit/projects/{$project->id}/iterations", [
            'name' => 'Backwards', 'starts_at' => '2026-12-14', 'ends_at' => '2026-12-01',
        ])->assertStatus(422);
    }

    public function test_a_contributor_can_start_and_complete_a_sprint(): void
    {
        $fixture = $this->createOrbitOrganization();
        $fixture['roles']->get('employee')->givePermissionTo('orbit.access');
        $project = $this->projectFor($fixture);
        $iteration = OrbitIteration::create(['project_id' => $project->id, 'name' => 'Sprint 1', 'starts_at' => '2026-12-01', 'ends_at' => '2026-12-14', 'status' => 'planned']);
        Sanctum::actingAs($fixture['employee']);

        $this->postJson("/api/orbit/iterations/{$iteration->id}/start")->assertOk()
            ->assertJsonPath('iteration.status', 'active');

        $this->postJson("/api/orbit/iterations/{$iteration->id}/complete")->assertOk()
            ->assertJsonPath('iteration.status', 'completed');
    }

    public function test_starting_a_second_sprint_while_one_is_already_active_is_rejected(): void
    {
        $fixture = $this->createOrbitOrganization();
        $project = $this->projectFor($fixture);
        $active = OrbitIteration::create(['project_id' => $project->id, 'name' => 'Sprint 1', 'starts_at' => '2026-12-01', 'ends_at' => '2026-12-14', 'status' => 'active', 'started_at' => now()]);
        $planned = OrbitIteration::create(['project_id' => $project->id, 'name' => 'Sprint 2', 'starts_at' => '2026-12-15', 'ends_at' => '2026-12-28', 'status' => 'planned']);
        Sanctum::actingAs($fixture['admin']);

        $this->postJson("/api/orbit/iterations/{$planned->id}/start")->assertStatus(422);
        $this->assertSame('planned', $planned->fresh()->status);
        $this->assertSame('active', $active->fresh()->status);
    }

    public function test_completing_a_sprint_carries_unfinished_items_to_the_target_sprint_and_leaves_done_items_alone(): void
    {
        $fixture = $this->createOrbitOrganization();
        $project = $this->projectFor($fixture);
        $sprint = OrbitIteration::create(['project_id' => $project->id, 'name' => 'Sprint 1', 'starts_at' => '2026-12-01', 'ends_at' => '2026-12-14', 'status' => 'active', 'started_at' => now()]);
        $nextSprint = OrbitIteration::create(['project_id' => $project->id, 'name' => 'Sprint 2', 'starts_at' => '2026-12-15', 'ends_at' => '2026-12-28', 'status' => 'planned']);

        $unfinished = $this->itemIn($project, $fixture, 'To Do');
        $unfinished->update(['iteration_id' => $sprint->id]);
        $finished = $this->itemIn($project, $fixture, 'Done');
        $finished->update(['iteration_id' => $sprint->id]);

        Sanctum::actingAs($fixture['admin']);
        $this->postJson("/api/orbit/iterations/{$sprint->id}/complete", ['carry_to_iteration_id' => $nextSprint->id])->assertOk();

        $this->assertSame($nextSprint->id, $unfinished->fresh()->iteration_id);
        $this->assertSame($sprint->id, $finished->fresh()->iteration_id);

        $this->assertDatabaseHas('orbit_iteration_carryovers', [
            'from_iteration_id' => $sprint->id,
            'to_iteration_id' => $nextSprint->id,
            'work_item_id' => $unfinished->id,
        ]);
        $this->assertDatabaseMissing('orbit_iteration_carryovers', ['work_item_id' => $finished->id]);
    }

    public function test_completing_a_sprint_with_no_target_returns_unfinished_items_to_the_backlog(): void
    {
        $fixture = $this->createOrbitOrganization();
        $project = $this->projectFor($fixture);
        $sprint = OrbitIteration::create(['project_id' => $project->id, 'name' => 'Sprint 1', 'starts_at' => '2026-12-01', 'ends_at' => '2026-12-14', 'status' => 'active', 'started_at' => now()]);

        $unfinished = $this->itemIn($project, $fixture, 'To Do');
        $unfinished->update(['iteration_id' => $sprint->id]);

        Sanctum::actingAs($fixture['admin']);
        $this->postJson("/api/orbit/iterations/{$sprint->id}/complete")->assertOk();

        $this->assertNull($unfinished->fresh()->iteration_id);
        $this->assertDatabaseHas('orbit_iteration_carryovers', ['work_item_id' => $unfinished->id, 'to_iteration_id' => null]);
    }

    public function test_carrying_over_into_a_sprint_that_is_not_planned_or_belongs_to_another_project_is_rejected(): void
    {
        $fixture = $this->createOrbitOrganization();
        $project = $this->projectFor($fixture);
        $otherProject = $this->projectFor($fixture, 'OTHER');
        $sprint = OrbitIteration::create(['project_id' => $project->id, 'name' => 'Sprint 1', 'starts_at' => '2026-12-01', 'ends_at' => '2026-12-14', 'status' => 'active', 'started_at' => now()]);
        $activeElsewhereInSameProject = OrbitIteration::create(['project_id' => $project->id, 'name' => 'Already active', 'starts_at' => '2026-12-15', 'ends_at' => '2026-12-28', 'status' => 'active', 'started_at' => now()]);
        $plannedInOtherProject = OrbitIteration::create(['project_id' => $otherProject->id, 'name' => 'Elsewhere', 'starts_at' => '2026-12-15', 'ends_at' => '2026-12-28', 'status' => 'planned']);

        Sanctum::actingAs($fixture['admin']);

        $this->postJson("/api/orbit/iterations/{$sprint->id}/complete", ['carry_to_iteration_id' => $activeElsewhereInSameProject->id])->assertStatus(422);
        $this->postJson("/api/orbit/iterations/{$sprint->id}/complete", ['carry_to_iteration_id' => $plannedInOtherProject->id])->assertStatus(422);
    }

    public function test_deleting_a_non_planned_sprint_is_rejected(): void
    {
        $fixture = $this->createOrbitOrganization();
        $project = $this->projectFor($fixture);
        $iteration = OrbitIteration::create(['project_id' => $project->id, 'name' => 'Sprint 1', 'starts_at' => '2026-12-01', 'ends_at' => '2026-12-14', 'status' => 'active', 'started_at' => now()]);
        Sanctum::actingAs($fixture['admin']);

        $this->deleteJson("/api/orbit/iterations/{$iteration->id}")->assertStatus(422);
        $this->assertDatabaseHas('orbit_iterations', ['id' => $iteration->id]);
    }

    public function test_deleting_a_planned_sprint_returns_its_work_items_to_the_backlog_instead_of_deleting_them(): void
    {
        $fixture = $this->createOrbitOrganization();
        $project = $this->projectFor($fixture);
        $iteration = OrbitIteration::create(['project_id' => $project->id, 'name' => 'Sprint 1', 'starts_at' => '2026-12-01', 'ends_at' => '2026-12-14', 'status' => 'planned']);
        $item = $this->itemIn($project, $fixture, 'To Do');
        $item->update(['iteration_id' => $iteration->id]);

        Sanctum::actingAs($fixture['admin']);
        $this->deleteJson("/api/orbit/iterations/{$iteration->id}")->assertOk();

        $this->assertDatabaseHas('orbit_work_items', ['id' => $item->id]);
        $this->assertNull($item->fresh()->iteration_id);
    }

    public function test_assigning_a_work_item_to_a_sprint_through_the_update_endpoint_records_an_activity_entry(): void
    {
        $fixture = $this->createOrbitOrganization();
        $project = $this->projectFor($fixture);
        $iteration = OrbitIteration::create(['project_id' => $project->id, 'name' => 'Sprint 1', 'starts_at' => '2026-12-01', 'ends_at' => '2026-12-14', 'status' => 'planned']);
        $item = $this->itemIn($project, $fixture, 'To Do');
        Sanctum::actingAs($fixture['admin']);

        $this->patchJson("/api/orbit/work-items/{$item->key}", ['version' => 1, 'iteration_id' => $iteration->id])->assertOk()
            ->assertJsonPath('work_item.iteration_id', $iteration->id);

        $this->assertDatabaseHas('orbit_work_item_activities', [
            'work_item_id' => $item->id,
            'event' => 'iteration_changed',
        ]);
    }
}
