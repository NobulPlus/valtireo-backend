<?php

namespace Tests\Feature\ServiceDesk;

use App\Models\ApprovalRequest;
use App\Models\ApprovalWorkflow;
use App\Models\Employee;
use App\Models\Organization;
use App\Models\Role;
use App\Models\Ticket;
use App\Models\TicketCategory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ServiceDeskModuleTest extends TestCase
{
    use RefreshDatabase;

    private function categoryId(int $organizationId, string $code): int
    {
        return TicketCategory::query()
            ->where('organization_id', $organizationId)
            ->where('code', $code)
            ->value('id');
    }

    public function test_employee_can_submit_ticket_and_approval_is_created(): void
    {
        $this->seed();

        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        Sanctum::actingAs($employeeUser);

        $ticketId = $this->postJson('/api/tickets', [
            'ticket_category_id' => $this->categoryId($employeeUser->organization_id, 'IT'),
            'subject' => 'Laptop not booting',
            'description' => 'My laptop shows a black screen after the last update.',
        ])
            ->assertCreated()
            ->assertJsonPath('ticket.status', 'submitted')
            ->assertJsonPath('ticket.category.code', 'IT')
            ->assertJsonPath('ticket.approval_requests.0.status', 'pending')
            ->assertJsonPath('ticket.approval_requests.0.module', 'service_desk')
            ->json('ticket.id');

        $this->assertDatabaseHas('tickets', [
            'id' => $ticketId,
            'status' => 'submitted',
            'ticket_category_id' => $this->categoryId($employeeUser->organization_id, 'IT'),
        ]);
        $this->assertDatabaseHas('approval_requests', [
            'approvable_id' => $ticketId,
            'module' => 'service_desk',
            'action' => 'it',
            'status' => 'pending',
        ]);
    }

    public function test_ticket_submission_with_attachment_stores_and_downloads_it(): void
    {
        Storage::fake('local');
        $this->seed();

        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        Sanctum::actingAs($employeeUser);

        $ticketId = $this->post('/api/tickets', [
            'ticket_category_id' => $this->categoryId($employeeUser->organization_id, 'FACILITIES'),
            'subject' => 'Broken chair',
            'description' => 'The chair at my desk is broken.',
            'attachment' => UploadedFile::fake()->create('photo.jpg', 128, 'image/jpeg'),
        ], ['Accept' => 'application/json'])
            ->assertCreated()
            ->assertJsonPath('ticket.attachment_file_name', 'photo.jpg')
            ->json('ticket.id');

        $ticket = Ticket::query()->findOrFail($ticketId);
        Storage::disk('local')->assertExists($ticket->attachment_file_path);

        $this->getJson("/api/tickets/{$ticketId}/attachment/download")->assertOk();
    }

    public function test_service_desk_view_holder_can_approve_ticket_via_approvals_endpoint(): void
    {
        $this->seed();

        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        $ictAdmin = User::query()->where('email', 'samuel.eze@valtireo.test')->firstOrFail();

        Sanctum::actingAs($employeeUser);
        $ticketId = $this->postJson('/api/tickets', [
            'ticket_category_id' => $this->categoryId($employeeUser->organization_id, 'IT'),
            'subject' => 'VPN access request',
            'description' => 'I need VPN access for remote work.',
        ])->assertCreated()->json('ticket.id');

        $approval = ApprovalRequest::query()->where('approvable_id', $ticketId)->where('module', 'service_desk')->firstOrFail();

        Sanctum::actingAs($ictAdmin);
        $this->postJson("/api/approvals/{$approval->id}/actions", ['action' => 'approve'])
            ->assertOk()
            ->assertJsonPath('approval_request.status', 'approved');

        $this->assertDatabaseHas('tickets', ['id' => $ticketId, 'status' => 'approved']);
    }

    public function test_rejecting_ticket_requires_note_and_syncs_status(): void
    {
        $this->seed();

        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        $ictAdmin = User::query()->where('email', 'samuel.eze@valtireo.test')->firstOrFail();

        Sanctum::actingAs($employeeUser);
        $ticketId = $this->postJson('/api/tickets', [
            'ticket_category_id' => $this->categoryId($employeeUser->organization_id, 'OTHER'),
            'subject' => 'General question',
            'description' => 'Just a question.',
        ])->assertCreated()->json('ticket.id');

        $approval = ApprovalRequest::query()->where('approvable_id', $ticketId)->firstOrFail();

        Sanctum::actingAs($ictAdmin);
        $this->postJson("/api/approvals/{$approval->id}/actions", ['action' => 'reject'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['note']);

        $this->postJson("/api/approvals/{$approval->id}/actions", ['action' => 'reject', 'note' => 'Not applicable.'])
            ->assertOk()
            ->assertJsonPath('approval_request.status', 'rejected');

        $this->assertDatabaseHas('tickets', ['id' => $ticketId, 'status' => 'rejected']);
    }

    public function test_request_changes_syncs_ticket_status(): void
    {
        $this->seed();

        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        $ictAdmin = User::query()->where('email', 'samuel.eze@valtireo.test')->firstOrFail();

        Sanctum::actingAs($employeeUser);
        $ticketId = $this->postJson('/api/tickets', [
            'ticket_category_id' => $this->categoryId($employeeUser->organization_id, 'OTHER'),
            'subject' => 'Policy clarification',
            'description' => 'Need clarification on the leave policy.',
        ])->assertCreated()->json('ticket.id');

        $approval = ApprovalRequest::query()->where('approvable_id', $ticketId)->firstOrFail();

        Sanctum::actingAs($ictAdmin);
        $this->postJson("/api/approvals/{$approval->id}/actions", ['action' => 'request_changes', 'note' => 'Please provide more detail.'])
            ->assertOk()
            ->assertJsonPath('approval_request.status', 'changes_requested');

        $this->assertDatabaseHas('tickets', ['id' => $ticketId, 'status' => 'changes_requested']);
    }

    public function test_employee_can_cancel_own_submitted_ticket(): void
    {
        $this->seed();

        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        Sanctum::actingAs($employeeUser);

        $ticketId = $this->postJson('/api/tickets', [
            'ticket_category_id' => $this->categoryId($employeeUser->organization_id, 'IT'),
            'subject' => 'Cancel me',
            'description' => 'Never mind, I fixed it myself.',
        ])->assertCreated()->json('ticket.id');

        $this->patchJson("/api/tickets/{$ticketId}/cancel")
            ->assertOk()
            ->assertJsonPath('ticket.status', 'cancelled');

        $this->assertDatabaseHas('tickets', ['id' => $ticketId, 'status' => 'cancelled']);
    }

    public function test_cannot_cancel_approved_ticket(): void
    {
        $this->seed();

        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        $ictAdmin = User::query()->where('email', 'samuel.eze@valtireo.test')->firstOrFail();

        Sanctum::actingAs($employeeUser);
        $ticketId = $this->postJson('/api/tickets', [
            'ticket_category_id' => $this->categoryId($employeeUser->organization_id, 'IT'),
            'subject' => 'Approve then try cancel',
            'description' => 'Testing cancel after approval.',
        ])->assertCreated()->json('ticket.id');

        $approval = ApprovalRequest::query()->where('approvable_id', $ticketId)->firstOrFail();

        Sanctum::actingAs($ictAdmin);
        $this->postJson("/api/approvals/{$approval->id}/actions", ['action' => 'approve'])->assertOk();

        Sanctum::actingAs($employeeUser);
        $this->patchJson("/api/tickets/{$ticketId}/cancel")
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['status']);

        $this->assertDatabaseHas('tickets', ['id' => $ticketId, 'status' => 'approved']);
    }

    public function test_employee_only_sees_their_own_tickets(): void
    {
        $this->seed();

        $aisha = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();

        $secondEmployee = Employee::factory()->create(['organization_id' => $aisha->organization_id]);
        $secondUser = User::factory()->create(['organization_id' => $aisha->organization_id]);
        $secondEmployee->update(['user_id' => $secondUser->id]);
        $employeeRole = Role::query()->where('organization_id', $aisha->organization_id)->where('key', 'employee')->firstOrFail();
        $this->actingAsInOrganization($secondUser);
        $secondUser->assignRole($employeeRole);

        Sanctum::actingAs($aisha);
        $this->postJson('/api/tickets', [
            'ticket_category_id' => $this->categoryId($aisha->organization_id, 'IT'),
            'subject' => "Aisha's ticket",
            'description' => 'Belongs to Aisha.',
        ])->assertCreated();

        Sanctum::actingAs($secondUser);
        $this->postJson('/api/tickets', [
            'ticket_category_id' => $this->categoryId($aisha->organization_id, 'IT'),
            'subject' => "Second employee's ticket",
            'description' => 'Belongs to the second employee.',
        ])->assertCreated();

        $this->getJson('/api/tickets')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.subject', "Second employee's ticket");
    }

    public function test_cannot_view_or_act_on_another_organizations_ticket(): void
    {
        $this->seed();

        // The acting user is Valtireo's own admin (full permissions in their
        // own tenant) so the FormRequest-level permission check passes and
        // execution actually reaches the organization-mismatch guard —
        // proving tenant isolation, not just an unrelated 403.
        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();

        $otherOrganization = Organization::query()->create([
            'name' => 'Other Ticket Tenant',
            'code' => 'OTHERTICKET',
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
            'subject' => 'Cross-tenant test',
            'description' => 'Should not be visible to another org.',
            'status' => 'submitted',
            'submitted_at' => now(),
        ]);

        Sanctum::actingAs($admin);
        $this->getJson("/api/tickets/{$ticket->id}")->assertNotFound();
        $this->patchJson("/api/tickets/{$ticket->id}/cancel")->assertNotFound();
    }

    public function test_ticket_submission_fails_with_clear_error_when_workflow_missing(): void
    {
        $this->seed();

        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();

        ApprovalWorkflow::query()
            ->where('organization_id', $employeeUser->organization_id)
            ->where('module', 'service_desk')
            ->where('action', 'it')
            ->delete();

        Sanctum::actingAs($employeeUser);
        $this->postJson('/api/tickets', [
            'ticket_category_id' => $this->categoryId($employeeUser->organization_id, 'IT'),
            'subject' => 'No workflow configured',
            'description' => 'This should fail cleanly.',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['approval_workflow'])
            ->assertJsonPath('errors.approval_workflow.0', 'No active approval workflow is configured for service_desk.it.');

        $this->assertDatabaseMissing('tickets', ['subject' => 'No workflow configured']);
    }
}
