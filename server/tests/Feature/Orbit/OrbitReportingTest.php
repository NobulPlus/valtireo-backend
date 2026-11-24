<?php

namespace Tests\Feature\Orbit;

use App\Models\OrbitIteration;
use App\Models\OrbitIterationCarryover;
use App\Models\OrbitProject;
use App\Models\OrbitProjectMember;
use App\Models\OrbitWorkItem;
use App\Models\OrbitWorkspace;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class OrbitReportingTest extends TestCase
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

    private function itemIn(OrbitProject $project, array $fixture, string $statusName, array $overrides = []): OrbitWorkItem
    {
        $status = $project->statuses()->where('name', $statusName)->firstOrFail();
        $number = $project->workItems()->count() + 1;

        return OrbitWorkItem::create(array_merge([
            'organization_id' => $fixture['organization']->id, 'project_id' => $project->id, 'key' => "{$project->key_prefix}-{$number}",
            'type' => 'task', 'title' => "Item {$number}", 'status_id' => $status->id, 'reporter_id' => $fixture['admin']->id,
            'position' => $number,
        ], $overrides));
    }

    public function test_a_non_member_of_a_private_project_is_denied(): void
    {
        $fixture = $this->createOrbitOrganization();
        $project = $this->projectFor($fixture);
        $project->update(['visibility' => 'private']);

        $outsider = User::create(['organization_id' => $fixture['organization']->id, 'name' => 'Outsider', 'email' => 'outsider-reporting@test.local', 'password' => 'Password1!']);
        $outsider->syncRoles([$fixture['roles']->get('employee')]);
        $fixture['roles']->get('employee')->givePermissionTo('orbit.access');
        Sanctum::actingAs($outsider);

        $this->getJson("/api/orbit/projects/{$project->id}/reporting")->assertNotFound();
    }

    public function test_a_plain_project_member_can_view_reporting(): void
    {
        $fixture = $this->createOrbitOrganization();
        $fixture['roles']->get('employee')->givePermissionTo('orbit.access');
        $project = $this->projectFor($fixture);
        Sanctum::actingAs($fixture['employee']);

        $this->getJson("/api/orbit/projects/{$project->id}/reporting")->assertOk();
    }

    public function test_an_empty_project_returns_a_zeroed_out_shape_not_an_error(): void
    {
        $fixture = $this->createOrbitOrganization();
        $project = $this->projectFor($fixture);
        Sanctum::actingAs($fixture['admin']);

        $this->getJson("/api/orbit/projects/{$project->id}/reporting")->assertOk()
            ->assertJsonPath('data.velocity.entries', [])
            ->assertJsonPath('data.velocity.average_points', null)
            ->assertJsonPath('data.velocity.median_points', null)
            ->assertJsonPath('data.sprint_summary', [])
            ->assertJsonPath('data.cycle_time.sample_size', 0)
            ->assertJsonPath('data.cycle_time.average_hours', null)
            ->assertJsonPath('data.active_sprint_burndown', null);
    }

    public function test_velocity_and_sprint_summary_sum_done_items_and_count_the_carryover(): void
    {
        $fixture = $this->createOrbitOrganization();
        $project = $this->projectFor($fixture);
        $sprint = OrbitIteration::create([
            'project_id' => $project->id, 'name' => 'Sprint 1', 'starts_at' => '2026-01-01', 'ends_at' => '2026-01-14',
            'status' => 'completed', 'started_at' => '2026-01-01', 'completed_at' => '2026-01-14',
        ]);

        $this->itemIn($project, $fixture, 'Done', ['estimate' => 3, 'iteration_id' => $sprint->id]);
        $this->itemIn($project, $fixture, 'Done', ['estimate' => 5, 'iteration_id' => $sprint->id]);
        $carried = $this->itemIn($project, $fixture, 'To Do', ['estimate' => 2, 'iteration_id' => null]);
        OrbitIterationCarryover::create([
            'from_iteration_id' => $sprint->id, 'to_iteration_id' => null, 'work_item_id' => $carried->id, 'carried_by_id' => $fixture['admin']->id,
        ]);

        Sanctum::actingAs($fixture['admin']);
        $response = $this->getJson("/api/orbit/projects/{$project->id}/reporting")->assertOk();

        $this->assertEquals($sprint->id, $response->json('data.velocity.entries.0.id'));
        $this->assertEquals(8, $response->json('data.velocity.entries.0.value'));
        $this->assertEquals(8, $response->json('data.velocity.average_points'));

        $summary = collect($response->json('data.sprint_summary'))->firstWhere('iteration_id', $sprint->id);
        $this->assertEquals(2, $summary['done_count']);
        $this->assertEquals(8, $summary['done_points']);
        $this->assertEquals(1, $summary['carried_over_count']);
        $this->assertEquals(2, $summary['carried_over_points']);
        $this->assertEquals(3, $summary['committed_count']);
        $this->assertEquals(10, $summary['committed_points']);
    }

    public function test_cycle_time_excludes_items_never_started_or_still_in_progress(): void
    {
        $fixture = $this->createOrbitOrganization();
        $project = $this->projectFor($fixture);

        $this->itemIn($project, $fixture, 'Done', [
            'started_at' => '2026-01-01 00:00:00', 'completed_at' => '2026-01-02 00:00:00',
        ]);
        $this->itemIn($project, $fixture, 'To Do'); // never started
        $this->itemIn($project, $fixture, 'To Do', ['started_at' => '2026-01-01 00:00:00']); // started, not completed

        Sanctum::actingAs($fixture['admin']);
        $response = $this->getJson("/api/orbit/projects/{$project->id}/reporting")->assertOk();

        $this->assertEquals(1, $response->json('data.cycle_time.sample_size'));
        $this->assertEquals(24, $response->json('data.cycle_time.average_hours'));
    }

    public function test_cycle_time_by_type_groups_correctly_and_omits_types_with_no_samples(): void
    {
        $fixture = $this->createOrbitOrganization();
        $project = $this->projectFor($fixture);

        $this->itemIn($project, $fixture, 'Done', [
            'type' => 'task', 'started_at' => '2026-01-01 00:00:00', 'completed_at' => '2026-01-02 00:00:00',
        ]);
        $this->itemIn($project, $fixture, 'Done', [
            'type' => 'task', 'started_at' => '2026-01-01 00:00:00', 'completed_at' => '2026-01-03 00:00:00',
        ]);
        $this->itemIn($project, $fixture, 'Done', [
            'type' => 'bug', 'started_at' => '2026-01-01 00:00:00', 'completed_at' => '2026-01-01 12:00:00',
        ]);

        Sanctum::actingAs($fixture['admin']);
        $response = $this->getJson("/api/orbit/projects/{$project->id}/reporting")->assertOk();

        $byType = collect($response->json('data.cycle_time.by_type'))->keyBy('type');
        $this->assertEquals(2, $byType['task']['sample_size']);
        $this->assertEquals(36, $byType['task']['average_hours']); // (24 + 48) / 2
        $this->assertEquals(1, $byType['bug']['sample_size']);
        $this->assertEquals(12, $byType['bug']['average_hours']);
        $this->assertFalse($byType->has('story'));
    }

    public function test_active_sprint_burndown_is_null_with_no_active_sprint(): void
    {
        $fixture = $this->createOrbitOrganization();
        $project = $this->projectFor($fixture);
        OrbitIteration::create(['project_id' => $project->id, 'name' => 'Planned', 'starts_at' => '2026-01-01', 'ends_at' => '2026-01-14', 'status' => 'planned']);

        Sanctum::actingAs($fixture['admin']);
        $this->getJson("/api/orbit/projects/{$project->id}/reporting")->assertOk()
            ->assertJsonPath('data.active_sprint_burndown', null);
    }

    public function test_active_sprint_burndown_totals_and_tracks_completion_across_days(): void
    {
        $fixture = $this->createOrbitOrganization();
        $project = $this->projectFor($fixture);
        $sprint = OrbitIteration::create([
            'project_id' => $project->id, 'name' => 'Sprint 1', 'starts_at' => '2026-01-01', 'ends_at' => '2026-01-05',
            'status' => 'active', 'started_at' => '2026-01-01',
        ]);

        $this->itemIn($project, $fixture, 'Done', [
            'estimate' => 5, 'iteration_id' => $sprint->id,
            'started_at' => '2026-01-01 00:00:00', 'completed_at' => '2026-01-03 00:00:00',
        ]);
        $this->itemIn($project, $fixture, 'To Do', ['estimate' => 3, 'iteration_id' => $sprint->id]);

        Sanctum::actingAs($fixture['admin']);
        $response = $this->getJson("/api/orbit/projects/{$project->id}/reporting")->assertOk();

        $this->assertEquals(8, $response->json('data.active_sprint_burndown.total_points'));
        $series = $response->json('data.active_sprint_burndown.series');
        $this->assertCount(5, $series);
        $this->assertEquals('2026-01-01', $series[0]['label']);
        $this->assertEquals(8, $series[0]['values']['actual']);
        $this->assertEquals('2026-01-05', $series[4]['label']);
        $this->assertEquals(8, $series[0]['values']['ideal']);
        $this->assertEquals(0, $series[4]['values']['ideal']);
        $this->assertEquals(3, $series[2]['values']['actual']); // the 5-point item is done by Jan 3
        $this->assertNotEmpty($response->json('data.active_sprint_burndown.approximation_note'));
    }

    public function test_a_kanban_project_still_returns_a_valid_empty_shape_not_an_error(): void
    {
        $fixture = $this->createOrbitOrganization();
        $project = $this->projectFor($fixture, 'KBRP', 'kanban');
        Sanctum::actingAs($fixture['admin']);

        $this->getJson("/api/orbit/projects/{$project->id}/reporting")->assertOk()
            ->assertJsonPath('data.velocity.entries', [])
            ->assertJsonPath('data.sprint_summary', [])
            ->assertJsonPath('data.active_sprint_burndown', null);
    }
}
