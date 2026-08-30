<?php

namespace Tests\Feature\ServiceDesk;

use App\Models\ApprovalRequest;
use App\Models\Organization;
use App\Models\Ticket;
use App\Models\TicketCategory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class TicketCommentTest extends TestCase
{
    use RefreshDatabase;

    private function categoryId(int $organizationId, string $code): int
    {
        return TicketCategory::query()
            ->where('organization_id', $organizationId)
            ->where('code', $code)
            ->value('id');
    }

    private function submitTicket(User $employeeUser): int
    {
        Sanctum::actingAs($employeeUser);

        return $this->postJson('/api/tickets', [
            'ticket_category_id' => $this->categoryId($employeeUser->organization_id, 'IT'),
            'subject' => 'Test ticket',
            'description' => 'Test description.',
        ])->assertCreated()->json('ticket.id');
    }

    public function test_employee_can_comment_on_their_own_ticket(): void
    {
        $this->seed();

        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        $ticketId = $this->submitTicket($employeeUser);

        Sanctum::actingAs($employeeUser);
        $this->postJson("/api/tickets/{$ticketId}/comments", ['comment' => 'Any update on this?'])
            ->assertCreated()
            ->assertJsonPath('comment.comment', 'Any update on this?')
            ->assertJsonPath('comment.user.id', $employeeUser->id);

        $this->getJson("/api/tickets/{$ticketId}")
            ->assertOk()
            ->assertJsonPath('data.comments.0.comment', 'Any update on this?');
    }

    public function test_resolver_can_comment_on_any_org_ticket(): void
    {
        $this->seed();

        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        $ictAdmin = User::query()->where('email', 'samuel.eze@valtireo.test')->firstOrFail();
        $ticketId = $this->submitTicket($employeeUser);

        Sanctum::actingAs($ictAdmin);
        $this->postJson("/api/tickets/{$ticketId}/comments", ['comment' => 'Looking into this now.'])
            ->assertCreated()
            ->assertJsonPath('comment.user.id', $ictAdmin->id);
    }

    public function test_internal_notes_are_hidden_from_employee_ticket_view(): void
    {
        $this->seed();

        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        $ictAdmin = User::query()->where('email', 'samuel.eze@valtireo.test')->firstOrFail();
        $ticketId = $this->submitTicket($employeeUser);

        Sanctum::actingAs($ictAdmin);
        $this->postJson("/api/tickets/{$ticketId}/comments", [
            'comment' => 'Internal triage note.',
            'visibility' => 'internal',
        ])
            ->assertCreated()
            ->assertJsonPath('comment.visibility', 'internal');

        $this->getJson("/api/tickets/{$ticketId}")
            ->assertOk()
            ->assertJsonFragment(['comment' => 'Internal triage note.']);

        Sanctum::actingAs($employeeUser);
        $this->getJson("/api/tickets/{$ticketId}")
            ->assertOk()
            ->assertJsonMissing(['comment' => 'Internal triage note.']);
    }

    public function test_employee_cannot_create_internal_note(): void
    {
        $this->seed();

        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        $ticketId = $this->submitTicket($employeeUser);

        Sanctum::actingAs($employeeUser);
        $this->postJson("/api/tickets/{$ticketId}/comments", [
            'comment' => 'Trying to hide this.',
            'visibility' => 'internal',
        ])->assertUnprocessable()->assertJsonValidationErrors(['visibility']);
    }

    public function test_employee_cannot_comment_on_another_employees_ticket(): void
    {
        $this->seed();

        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        $joy = User::query()->where('email', 'joy.udo@valtireo.test')->first();
        $ticketId = $this->submitTicket($employeeUser);

        $secondEmployee = \App\Models\Employee::factory()->create(['organization_id' => $employeeUser->organization_id]);
        $secondUser = User::factory()->create(['organization_id' => $employeeUser->organization_id]);
        $secondEmployee->update(['user_id' => $secondUser->id]);
        $employeeRole = \App\Models\Role::query()->where('organization_id', $employeeUser->organization_id)->where('key', 'employee')->firstOrFail();
        $this->actingAsInOrganization($secondUser);
        $secondUser->assignRole($employeeRole);

        Sanctum::actingAs($secondUser);
        $this->postJson("/api/tickets/{$ticketId}/comments", ['comment' => 'Not my ticket.'])->assertForbidden();

        // Sanity: confirm joy is simply unused/draft data, not asserted on.
        $this->assertNull($joy?->email === 'joy.udo@valtireo.test' ? null : $joy);
    }

    public function test_cannot_comment_on_another_organizations_ticket(): void
    {
        $this->seed();

        $ictAdmin = User::query()->where('email', 'samuel.eze@valtireo.test')->firstOrFail();

        $otherOrganization = Organization::query()->create([
            'name' => 'Other Comment Tenant',
            'code' => 'OTHERCOMMENT',
            'status' => 'active',
            'country' => 'Nigeria',
            'settings' => [],
        ]);
        $otherEmployee = \App\Models\Employee::factory()->create(['organization_id' => $otherOrganization->id]);
        $otherCategory = TicketCategory::query()->create([
            'organization_id' => $otherOrganization->id,
            'name' => 'IT',
            'code' => 'IT',
        ]);
        $ticket = Ticket::query()->create([
            'organization_id' => $otherOrganization->id,
            'employee_id' => $otherEmployee->id,
            'ticket_category_id' => $otherCategory->id,
            'subject' => 'Cross-tenant comment test',
            'description' => 'Should not be commentable from another org.',
            'status' => 'submitted',
            'submitted_at' => now(),
        ]);

        Sanctum::actingAs($ictAdmin);
        $this->postJson("/api/tickets/{$ticket->id}/comments", ['comment' => 'Should fail.'])->assertNotFound();
    }

    public function test_resolve_note_and_reopen_reason_are_recorded_as_comments(): void
    {
        $this->seed();

        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        $ictAdmin = User::query()->where('email', 'samuel.eze@valtireo.test')->firstOrFail();
        $ticketId = $this->submitTicket($employeeUser);

        $approval = ApprovalRequest::query()->where('approvable_id', $ticketId)->where('module', 'service_desk')->firstOrFail();
        Sanctum::actingAs($ictAdmin);
        $this->postJson("/api/approvals/{$approval->id}/actions", ['action' => 'approve'])->assertOk();

        $this->patchJson("/api/tickets/{$ticketId}/resolve", ['note' => 'Replaced the faulty part.'])->assertOk();
        $this->assertDatabaseHas('ticket_comments', ['ticket_id' => $ticketId, 'comment' => 'Replaced the faulty part.']);

        $this->patchJson("/api/tickets/{$ticketId}/reopen", ['reason' => 'Still not working.'])->assertOk();
        $this->assertDatabaseHas('ticket_comments', ['ticket_id' => $ticketId, 'comment' => 'Reopened: Still not working.']);
    }
}
