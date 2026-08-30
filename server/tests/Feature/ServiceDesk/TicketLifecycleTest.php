<?php

namespace Tests\Feature\ServiceDesk;

use App\Models\ApprovalRequest;
use App\Models\Employee;
use App\Models\Organization;
use App\Models\Ticket;
use App\Models\TicketCategory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class TicketLifecycleTest extends TestCase
{
    use RefreshDatabase;

    private function categoryId(int $organizationId, string $code): int
    {
        return TicketCategory::query()
            ->where('organization_id', $organizationId)
            ->where('code', $code)
            ->value('id');
    }

    private function submitTicket(User $employeeUser, string $category = 'IT'): int
    {
        Sanctum::actingAs($employeeUser);

        return $this->postJson('/api/tickets', [
            'ticket_category_id' => $this->categoryId($employeeUser->organization_id, $category),
            'subject' => 'Test ticket',
            'description' => 'Test description.',
        ])->assertCreated()->json('ticket.id');
    }

    private function approveTicket(int $ticketId, User $ictAdmin): void
    {
        $approval = ApprovalRequest::query()->where('approvable_id', $ticketId)->where('module', 'service_desk')->firstOrFail();
        Sanctum::actingAs($ictAdmin);
        $this->postJson("/api/approvals/{$approval->id}/actions", ['action' => 'approve'])->assertOk();
    }

    public function test_service_desk_view_holder_can_assign_and_unassign_a_ticket(): void
    {
        $this->seed();

        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        $ictAdmin = User::query()->where('email', 'samuel.eze@valtireo.test')->firstOrFail();
        $hrOfficer = User::query()->where('email', 'kelechi.nwosu@valtireo.test')->firstOrFail();

        $ticketId = $this->submitTicket($employeeUser);

        Sanctum::actingAs($ictAdmin);
        $this->patchJson("/api/tickets/{$ticketId}/assign", ['assigned_to_user_id' => $hrOfficer->id])
            ->assertOk()
            ->assertJsonPath('ticket.assigned_to.id', $hrOfficer->id);

        $this->assertDatabaseHas('tickets', ['id' => $ticketId, 'assigned_to_user_id' => $hrOfficer->id]);

        $this->patchJson("/api/tickets/{$ticketId}/assign", ['assigned_to_user_id' => null])
            ->assertOk()
            ->assertJsonPath('ticket.assigned_to', null);

        $this->assertDatabaseHas('tickets', ['id' => $ticketId, 'assigned_to_user_id' => null]);
    }

    public function test_cannot_assign_a_ticket_to_a_user_without_service_desk_view(): void
    {
        $this->seed();

        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        $ictAdmin = User::query()->where('email', 'samuel.eze@valtireo.test')->firstOrFail();

        $ticketId = $this->submitTicket($employeeUser);

        Sanctum::actingAs($ictAdmin);
        $this->patchJson("/api/tickets/{$ticketId}/assign", ['assigned_to_user_id' => $employeeUser->id])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['assigned_to_user_id']);
    }

    public function test_cannot_assign_a_ticket_to_a_user_in_another_organization(): void
    {
        $this->seed();

        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        $ictAdmin = User::query()->where('email', 'samuel.eze@valtireo.test')->firstOrFail();

        $ticketId = $this->submitTicket($employeeUser);

        $otherOrganization = Organization::query()->create([
            'name' => 'Other Assign Tenant',
            'code' => 'OTHERASSIGN',
            'status' => 'active',
            'country' => 'Nigeria',
            'settings' => [],
        ]);
        $otherUser = User::factory()->create(['organization_id' => $otherOrganization->id]);

        Sanctum::actingAs($ictAdmin);
        $this->patchJson("/api/tickets/{$ticketId}/assign", ['assigned_to_user_id' => $otherUser->id])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['assigned_to_user_id']);
    }

    public function test_employee_cannot_assign_a_ticket(): void
    {
        $this->seed();

        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        $ticketId = $this->submitTicket($employeeUser);

        Sanctum::actingAs($employeeUser);
        $this->patchJson("/api/tickets/{$ticketId}/assign", ['assigned_to_user_id' => null])->assertForbidden();
    }

    public function test_ticket_can_only_be_resolved_once_approved(): void
    {
        $this->seed();

        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        $ictAdmin = User::query()->where('email', 'samuel.eze@valtireo.test')->firstOrFail();
        $ticketId = $this->submitTicket($employeeUser);

        Sanctum::actingAs($ictAdmin);
        $this->patchJson("/api/tickets/{$ticketId}/resolve")
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['status']);

        $this->approveTicket($ticketId, $ictAdmin);

        Sanctum::actingAs($ictAdmin);
        $this->patchJson("/api/tickets/{$ticketId}/resolve")
            ->assertOk()
            ->assertJsonPath('ticket.status', 'resolved');

        $this->assertDatabaseHas('tickets', ['id' => $ticketId, 'status' => 'resolved']);
        $this->assertDatabaseMissing('tickets', ['id' => $ticketId, 'resolved_at' => null]);
    }

    public function test_assignee_can_resolve_their_own_assigned_ticket(): void
    {
        $this->seed();

        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        $ictAdmin = User::query()->where('email', 'samuel.eze@valtireo.test')->firstOrFail();
        $hrOfficer = User::query()->where('email', 'kelechi.nwosu@valtireo.test')->firstOrFail();

        $ticketId = $this->submitTicket($employeeUser);
        $this->approveTicket($ticketId, $ictAdmin);

        Sanctum::actingAs($ictAdmin);
        $this->patchJson("/api/tickets/{$ticketId}/assign", ['assigned_to_user_id' => $hrOfficer->id])->assertOk();

        Sanctum::actingAs($hrOfficer);
        $this->patchJson("/api/tickets/{$ticketId}/resolve")
            ->assertOk()
            ->assertJsonPath('ticket.status', 'resolved');
    }

    public function test_plain_employee_cannot_resolve_a_ticket(): void
    {
        $this->seed();

        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        $ictAdmin = User::query()->where('email', 'samuel.eze@valtireo.test')->firstOrFail();
        $ticketId = $this->submitTicket($employeeUser);
        $this->approveTicket($ticketId, $ictAdmin);

        Sanctum::actingAs($employeeUser);
        $this->patchJson("/api/tickets/{$ticketId}/resolve")->assertForbidden();
    }

    public function test_ticket_can_only_be_reopened_once_resolved(): void
    {
        $this->seed();

        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        $ictAdmin = User::query()->where('email', 'samuel.eze@valtireo.test')->firstOrFail();
        $ticketId = $this->submitTicket($employeeUser);
        $this->approveTicket($ticketId, $ictAdmin);

        Sanctum::actingAs($ictAdmin);
        $this->patchJson("/api/tickets/{$ticketId}/reopen", ['reason' => 'Testing reopen before resolve.'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['status']);

        $this->patchJson("/api/tickets/{$ticketId}/resolve")->assertOk();

        $approval = ApprovalRequest::query()->where('approvable_id', $ticketId)->where('module', 'service_desk')->firstOrFail();

        $this->patchJson("/api/tickets/{$ticketId}/reopen", ['reason' => 'The fix did not work.'])
            ->assertOk()
            ->assertJsonPath('ticket.status', 'in_progress');

        $this->assertDatabaseHas('tickets', ['id' => $ticketId, 'status' => 'in_progress', 'resolved_at' => null]);

        // Reopening must not touch the already-terminal ApprovalRequest.
        $this->assertDatabaseHas('approval_requests', ['id' => $approval->id, 'status' => 'approved']);
    }

    public function test_resolver_can_operate_full_ticket_workflow(): void
    {
        $this->seed();

        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        $ictAdmin = User::query()->where('email', 'samuel.eze@valtireo.test')->firstOrFail();
        $ticketId = $this->submitTicket($employeeUser);
        $this->approveTicket($ticketId, $ictAdmin);

        Sanctum::actingAs($ictAdmin);

        $this->patchJson("/api/tickets/{$ticketId}/start", ['note' => 'Taking ownership.'])
            ->assertOk()
            ->assertJsonPath('ticket.status', 'in_progress');

        $this->patchJson("/api/tickets/{$ticketId}/hold", ['reason' => 'Waiting for a replacement charger.'])
            ->assertOk()
            ->assertJsonPath('ticket.status', 'on_hold')
            ->assertJsonPath('ticket.hold_reason', 'Waiting for a replacement charger.');

        $this->patchJson("/api/tickets/{$ticketId}/resume", ['note' => 'Part has arrived.'])
            ->assertOk()
            ->assertJsonPath('ticket.status', 'in_progress');

        $this->patchJson("/api/tickets/{$ticketId}/escalate", ['priority' => 'urgent', 'note' => 'Escalating due business impact.'])
            ->assertOk()
            ->assertJsonPath('ticket.priority', 'urgent')
            ->assertJsonPath('ticket.escalation_level', 1);

        $this->patchJson("/api/tickets/{$ticketId}/resolve", ['note' => 'Fixed and confirmed.'])
            ->assertOk()
            ->assertJsonPath('ticket.status', 'resolved');

        Sanctum::actingAs($employeeUser);
        $this->patchJson("/api/tickets/{$ticketId}/close", [
            'satisfaction_rating' => 5,
            'satisfaction_comment' => 'Everything works now.',
        ])
            ->assertOk()
            ->assertJsonPath('ticket.status', 'closed')
            ->assertJsonPath('ticket.satisfaction_rating', 5);

        $this->assertDatabaseHas('ticket_activities', ['ticket_id' => $ticketId, 'event' => 'work_started']);
        $this->assertDatabaseHas('ticket_activities', ['ticket_id' => $ticketId, 'event' => 'ticket_on_hold']);
        $this->assertDatabaseHas('ticket_activities', ['ticket_id' => $ticketId, 'event' => 'ticket_escalated']);
        $this->assertDatabaseHas('ticket_activities', ['ticket_id' => $ticketId, 'event' => 'ticket_closed']);
    }

    public function test_cannot_assign_resolve_or_reopen_another_organizations_ticket(): void
    {
        $this->seed();

        $ictAdmin = User::query()->where('email', 'samuel.eze@valtireo.test')->firstOrFail();

        $otherOrganization = Organization::query()->create([
            'name' => 'Other Lifecycle Tenant',
            'code' => 'OTHERLIFECYCLE',
            'status' => 'active',
            'country' => 'Nigeria',
            'settings' => [],
        ]);
        $otherEmployee = Employee::factory()->create(['organization_id' => $otherOrganization->id]);
        $otherCategory = TicketCategory::query()->create([
            'organization_id' => $otherOrganization->id,
            'name' => 'IT',
            'code' => 'IT',
        ]);
        $ticket = Ticket::query()->create([
            'organization_id' => $otherOrganization->id,
            'employee_id' => $otherEmployee->id,
            'ticket_category_id' => $otherCategory->id,
            'subject' => 'Cross-tenant lifecycle test',
            'description' => 'Should not be actionable from another org.',
            'status' => 'approved',
            'submitted_at' => now(),
        ]);

        Sanctum::actingAs($ictAdmin);
        $this->patchJson("/api/tickets/{$ticket->id}/assign", ['assigned_to_user_id' => null])->assertNotFound();
        $this->patchJson("/api/tickets/{$ticket->id}/resolve")->assertNotFound();
        $this->patchJson("/api/tickets/{$ticket->id}/reopen", ['reason' => 'Testing.'])->assertNotFound();
    }
}
