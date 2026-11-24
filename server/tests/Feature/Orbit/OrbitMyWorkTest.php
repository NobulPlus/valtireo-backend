<?php

namespace Tests\Feature\Orbit;

use App\Models\OrbitProject;
use App\Models\OrbitProjectMember;
use App\Models\OrbitWorkItem;
use App\Models\OrbitWorkspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class OrbitMyWorkTest extends TestCase
{
    use RefreshDatabase, SetsUpOrbitOrganization;

    public function test_my_work_includes_an_assigned_items_labels_and_epic(): void
    {
        $fixture = $this->createOrbitOrganization();
        $workspace = OrbitWorkspace::create(['organization_id' => $fixture['organization']->id, 'name' => 'WS', 'slug' => 'ws-myw', 'owner_id' => $fixture['admin']->id]);
        $project = OrbitProject::create(['organization_id' => $fixture['organization']->id, 'workspace_id' => $workspace->id, 'name' => 'Project', 'key_prefix' => 'MYW', 'mode' => 'scrum']);
        $status = \App\Models\OrbitStatus::create(['project_id' => $project->id, 'name' => 'To Do', 'category' => 'todo', 'position' => 1, 'is_default' => true]);
        OrbitProjectMember::create(['organization_id' => $fixture['organization']->id, 'project_id' => $project->id, 'user_id' => $fixture['admin']->id, 'role' => 'admin']);

        $epic = OrbitWorkItem::create([
            'organization_id' => $fixture['organization']->id, 'project_id' => $project->id, 'key' => 'MYW-1',
            'type' => 'epic', 'title' => 'Checkout revamp', 'status_id' => $status->id, 'reporter_id' => $fixture['admin']->id, 'position' => 1,
        ]);
        $label = \App\Models\OrbitLabel::create(['project_id' => $project->id, 'name' => 'Payments', 'color' => '#C47A00']);
        $item = OrbitWorkItem::create([
            'organization_id' => $fixture['organization']->id, 'project_id' => $project->id, 'key' => 'MYW-2',
            'type' => 'story', 'title' => 'Add Apple Pay', 'status_id' => $status->id, 'reporter_id' => $fixture['admin']->id,
            'assignee_id' => $fixture['admin']->id, 'epic_id' => $epic->id, 'position' => 2,
        ]);
        $item->labels()->attach($label->id);

        Sanctum::actingAs($fixture['admin']);

        $response = $this->getJson('/api/orbit/my-work')->assertOk();

        $this->assertSame($epic->id, $response->json('data.0.epic.id'));
        $this->assertSame('Payments', $response->json('data.0.labels.0.name'));
    }
}
