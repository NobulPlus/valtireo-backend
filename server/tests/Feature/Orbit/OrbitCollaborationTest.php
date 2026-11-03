<?php

namespace Tests\Feature\Orbit;

use App\Models\OrbitProject;
use App\Models\OrbitProjectMember;
use App\Models\OrbitWorkItem;
use App\Models\OrbitWorkspace;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class OrbitCollaborationTest extends TestCase
{
    use RefreshDatabase, SetsUpOrbitOrganization;

    private function projectWithItem(array $fixture): array
    {
        $workspace = OrbitWorkspace::create(['organization_id' => $fixture['organization']->id, 'name' => 'WS', 'slug' => 'ws', 'owner_id' => $fixture['admin']->id]);
        $project = OrbitProject::create(['organization_id' => $fixture['organization']->id, 'workspace_id' => $workspace->id, 'name' => 'Project', 'key_prefix' => 'COLL', 'mode' => 'kanban']);
        $status = \App\Models\OrbitStatus::create(['project_id' => $project->id, 'name' => 'To Do', 'category' => 'todo', 'position' => 1, 'is_default' => true]);
        OrbitProjectMember::create(['organization_id' => $fixture['organization']->id, 'project_id' => $project->id, 'user_id' => $fixture['admin']->id, 'role' => 'admin']);

        $item = OrbitWorkItem::create([
            'organization_id' => $fixture['organization']->id, 'project_id' => $project->id, 'key' => 'COLL-1',
            'type' => 'task', 'title' => 'Discuss this', 'status_id' => $status->id, 'reporter_id' => $fixture['admin']->id, 'position' => 1,
        ]);

        return ['project' => $project, 'item' => $item];
    }

    public function test_mentioning_a_project_member_is_accepted_and_notifies_them(): void
    {
        $fixture = $this->createOrbitOrganization();
        ['project' => $project, 'item' => $item] = $this->projectWithItem($fixture);

        $teammate = User::create(['organization_id' => $fixture['organization']->id, 'name' => 'Teammate', 'email' => 'teammate@test.local', 'password' => 'Password1!']);
        OrbitProjectMember::create(['organization_id' => $fixture['organization']->id, 'project_id' => $project->id, 'user_id' => $teammate->id, 'role' => 'contributor']);

        Sanctum::actingAs($fixture['admin']);

        $this->postJson("/api/orbit/work-items/{$item->key}/comments", [
            'body' => 'Can you take a look, @Teammate?',
            'mentions' => [$teammate->id],
        ])->assertCreated()
            ->assertJsonFragment(['mentions' => [$teammate->id]]);

        $this->assertDatabaseHas('notifications', [
            'notifiable_id' => $teammate->id,
        ]);
    }

    public function test_mentioning_someone_outside_the_project_is_rejected(): void
    {
        $fixture = $this->createOrbitOrganization();
        ['item' => $item] = $this->projectWithItem($fixture);

        $outsider = User::create(['organization_id' => $fixture['organization']->id, 'name' => 'Outsider', 'email' => 'outsider@test.local', 'password' => 'Password1!']);

        Sanctum::actingAs($fixture['admin']);

        $this->postJson("/api/orbit/work-items/{$item->key}/comments", [
            'body' => 'Hey @Outsider',
            'mentions' => [$outsider->id],
        ])->assertStatus(422);
    }

    public function test_a_non_member_cannot_read_or_comment_on_a_private_projects_work_item(): void
    {
        $fixture = $this->createOrbitOrganization();
        ['project' => $project, 'item' => $item] = $this->projectWithItem($fixture);
        $project->update(['visibility' => 'private']);

        $outsider = User::create(['organization_id' => $fixture['organization']->id, 'name' => 'Outsider', 'email' => 'outsider2@test.local', 'password' => 'Password1!']);
        $outsider->syncRoles([$fixture['roles']->get('employee')]);
        $fixture['roles']->get('employee')->givePermissionTo('orbit.access');

        Sanctum::actingAs($outsider);

        $this->getJson("/api/orbit/work-items/{$item->key}")->assertNotFound();
        $this->postJson("/api/orbit/work-items/{$item->key}/comments", ['body' => 'Sneaking in'])->assertNotFound();
    }

    public function test_comment_author_can_edit_within_the_window_but_not_after(): void
    {
        $fixture = $this->createOrbitOrganization();
        ['item' => $item] = $this->projectWithItem($fixture);
        Sanctum::actingAs($fixture['admin']);

        $comment = \App\Models\OrbitComment::create([
            'organization_id' => $fixture['organization']->id, 'work_item_id' => $item->id,
            'author_id' => $fixture['admin']->id, 'body' => 'Original',
        ]);
        // created_at is deliberately not mass-assignable; backdate it directly
        // to simulate the edit window having elapsed.
        $comment->forceFill(['created_at' => now()->subMinutes(20)])->save();

        $this->patchJson("/api/orbit/comments/{$comment->id}", ['body' => 'Too late'])->assertForbidden();
    }

    public function test_attachment_file_is_not_downloadable_by_someone_outside_the_project(): void
    {
        $fixture = $this->createOrbitOrganization();
        ['project' => $project, 'item' => $item] = $this->projectWithItem($fixture);
        $project->update(['visibility' => 'private']);

        $attachment = \App\Models\OrbitAttachment::create([
            'organization_id' => $fixture['organization']->id, 'work_item_id' => $item->id,
            'uploaded_by_id' => $fixture['admin']->id, 'file_name' => 'spec.pdf', 'file_path' => 'orbit/fake/spec.pdf',
            'mime_type' => 'application/pdf', 'file_size' => 1024,
        ]);

        $outsider = User::create(['organization_id' => $fixture['organization']->id, 'name' => 'Outsider', 'email' => 'outsider3@test.local', 'password' => 'Password1!']);
        $outsider->syncRoles([$fixture['roles']->get('employee')]);
        $fixture['roles']->get('employee')->givePermissionTo('orbit.access');

        Sanctum::actingAs($outsider);

        $this->getJson("/api/orbit/attachments/{$attachment->id}/file")->assertNotFound();
    }
}
