<?php

namespace Tests\Feature\ServiceDesk;

use App\Models\Department;
use App\Models\Organization;
use App\Models\TicketCategory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class TicketDirectRoutingTest extends TestCase
{
    use RefreshDatabase;

    private function categoryId(int $organizationId, string $code): int
    {
        return TicketCategory::query()
            ->where('organization_id', $organizationId)
            ->where('code', $code)
            ->value('id');
    }

    public function test_employee_without_service_desk_view_can_fetch_resolvers_with_department_info(): void
    {
        $this->seed();

        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        $directAssignee = User::query()->where('email', 'daniel.adeyemi@valtireo.test')->firstOrFail();

        Sanctum::actingAs($employeeUser);
        $response = $this->getJson('/api/tickets/resolvers')->assertOk()->json('data');

        $this->assertFalse($employeeUser->can('service_desk.view'));

        $this->assertNotEmpty($response);
        $ictResolver = collect($response)->firstWhere('email', 'samuel.eze@valtireo.test');
        $this->assertNotNull($ictResolver);
        $this->assertTrue($ictResolver['can_view_service_desk_queue']);
        $this->assertSame('ICT', $ictResolver['department']['name'] ?? null);

        $employeeAssignee = collect($response)->firstWhere('email', $directAssignee->email);
        $this->assertNotNull($employeeAssignee);
        $this->assertFalse($employeeAssignee['can_view_service_desk_queue']);
    }

    public function test_ticket_can_be_sent_directly_to_a_specific_resolver(): void
    {
        $this->seed();

        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        $ictAdmin = User::query()->where('email', 'samuel.eze@valtireo.test')->firstOrFail();

        Sanctum::actingAs($employeeUser);
        $this->postJson('/api/tickets', [
            'ticket_category_id' => $this->categoryId($employeeUser->organization_id, 'IT'),
            'subject' => 'Direct to Samuel',
            'description' => 'Please help directly.',
            'assigned_to_user_id' => $ictAdmin->id,
        ])
            ->assertCreated()
            ->assertJsonPath('ticket.status', 'approved')
            ->assertJsonPath('ticket.assigned_to.id', $ictAdmin->id);

        $this->assertDatabaseHas('notifications', [
            'notifiable_id' => $ictAdmin->id,
            'data->event' => 'ticket.assigned',
        ]);
    }

    public function test_ticket_can_be_sent_directly_to_an_active_employee_without_service_desk_access(): void
    {
        $this->seed();

        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        $directAssignee = User::query()->where('email', 'daniel.adeyemi@valtireo.test')->firstOrFail();
        $this->setPermissionsTeamId($directAssignee->organization_id);
        $this->assertFalse($directAssignee->can('service_desk.view'));

        Sanctum::actingAs($employeeUser);
        $ticketId = $this->postJson('/api/tickets', [
            'ticket_category_id' => $this->categoryId($employeeUser->organization_id, 'IT'),
            'subject' => 'Direct colleague support',
            'description' => 'Target is an active employee without full queue access.',
            'assigned_to_user_id' => $directAssignee->id,
        ])
            ->assertCreated()
            ->assertJsonPath('ticket.assigned_to.id', $directAssignee->id)
            ->json('ticket.id');

        Sanctum::actingAs($directAssignee);
        $this->getJson('/api/tickets')
            ->assertOk()
            ->assertJsonPath('data.0.id', $ticketId);
    }

    public function test_ticket_can_be_routed_to_a_department_and_notifies_its_resolvers(): void
    {
        $this->seed();

        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        $ictAdmin = User::query()->where('email', 'samuel.eze@valtireo.test')->firstOrFail();
        $ictDepartment = Department::query()->where('organization_id', $employeeUser->organization_id)->where('code', 'ICT')->firstOrFail();

        Sanctum::actingAs($employeeUser);
        $this->postJson('/api/tickets', [
            'ticket_category_id' => $this->categoryId($employeeUser->organization_id, 'OTHER'),
            'subject' => 'General issue for ICT',
            'description' => 'Routing to the ICT department.',
            'department_id' => $ictDepartment->id,
        ])
            ->assertCreated()
            ->assertJsonPath('ticket.department.code', 'ICT');

        $this->assertDatabaseHas('notifications', [
            'notifiable_id' => $ictAdmin->id,
            'data->event' => 'ticket.department_alert',
        ]);
    }

    public function test_assignee_and_department_must_belong_to_the_submitters_organization(): void
    {
        $this->seed();

        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();

        $otherOrganization = Organization::query()->create([
            'name' => 'Other Routing Tenant',
            'code' => 'OTHERROUTING',
            'status' => 'active',
            'country' => 'Nigeria',
            'settings' => [],
        ]);
        $otherUser = User::factory()->create(['organization_id' => $otherOrganization->id]);
        $otherDepartment = Department::query()->create([
            'organization_id' => $otherOrganization->id,
            'name' => 'Other Dept',
            'code' => 'OTHERDEPT',
            'is_active' => true,
        ]);

        Sanctum::actingAs($employeeUser);

        $this->postJson('/api/tickets', [
            'ticket_category_id' => $this->categoryId($employeeUser->organization_id, 'IT'),
            'subject' => 'Cross-org assignee',
            'description' => 'Should fail.',
            'assigned_to_user_id' => $otherUser->id,
        ])->assertUnprocessable()->assertJsonValidationErrors(['assigned_to_user_id']);

        $this->postJson('/api/tickets', [
            'ticket_category_id' => $this->categoryId($employeeUser->organization_id, 'IT'),
            'subject' => 'Cross-org department',
            'description' => 'Should fail.',
            'department_id' => $otherDepartment->id,
        ])->assertUnprocessable()->assertJsonValidationErrors(['department_id']);
    }

    public function test_queue_filters_by_department_id(): void
    {
        $this->seed();

        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        $ictAdmin = User::query()->where('email', 'samuel.eze@valtireo.test')->firstOrFail();
        $ictDepartment = Department::query()->where('organization_id', $employeeUser->organization_id)->where('code', 'ICT')->firstOrFail();

        Sanctum::actingAs($employeeUser);
        $withDeptId = $this->postJson('/api/tickets', [
            'ticket_category_id' => $this->categoryId($employeeUser->organization_id, 'IT'),
            'subject' => 'Has a department',
            'description' => 'Routed ticket.',
            'department_id' => $ictDepartment->id,
        ])->assertCreated()->json('ticket.id');

        $withoutDeptId = $this->postJson('/api/tickets', [
            'ticket_category_id' => $this->categoryId($employeeUser->organization_id, 'IT'),
            'subject' => 'No department',
            'description' => 'Unrouted ticket.',
        ])->assertCreated()->json('ticket.id');

        Sanctum::actingAs($ictAdmin);
        $this->assertSame(
            [$withDeptId],
            $this->getJson("/api/tickets?department_id={$ictDepartment->id}")->assertOk()->json('data.*.id'),
        );

        $this->assertContains($withoutDeptId, $this->getJson('/api/tickets')->assertOk()->json('data.*.id'));
    }

    public function test_direct_assignee_submission_can_start_without_approval(): void
    {
        $this->seed();

        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        $ictAdmin = User::query()->where('email', 'samuel.eze@valtireo.test')->firstOrFail();

        Sanctum::actingAs($employeeUser);
        $ticketId = $this->postJson('/api/tickets', [
            'ticket_category_id' => $this->categoryId($employeeUser->organization_id, 'IT'),
            'subject' => 'Direct routing skips approval',
            'description' => 'Should land approved with no approval request.',
            'assigned_to_user_id' => $ictAdmin->id,
        ])
            ->assertCreated()
            ->assertJsonPath('ticket.status', 'approved')
            ->assertJsonPath('ticket.approval_requests', [])
            ->json('ticket.id');

        Sanctum::actingAs($ictAdmin);
        $this->patchJson("/api/tickets/{$ticketId}/start", [])
            ->assertOk()
            ->assertJsonPath('ticket.status', 'in_progress');

        $this->assertDatabaseMissing('approval_requests', [
            'approvable_id' => $ticketId,
            'module' => 'service_desk',
        ]);
    }

    public function test_department_only_submission_can_start_without_approval(): void
    {
        $this->seed();

        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        $ictAdmin = User::query()->where('email', 'samuel.eze@valtireo.test')->firstOrFail();
        $ictDepartment = Department::query()->where('organization_id', $employeeUser->organization_id)->where('code', 'ICT')->firstOrFail();

        Sanctum::actingAs($employeeUser);
        $ticketId = $this->postJson('/api/tickets', [
            'ticket_category_id' => $this->categoryId($employeeUser->organization_id, 'OTHER'),
            'subject' => 'Department-only skips approval too',
            'description' => 'No specific person, but a clear department owner.',
            'department_id' => $ictDepartment->id,
        ])
            ->assertCreated()
            ->assertJsonPath('ticket.status', 'approved')
            ->assertJsonPath('ticket.approval_requests', [])
            ->json('ticket.id');

        Sanctum::actingAs($ictAdmin);
        $this->patchJson("/api/tickets/{$ticketId}/start", [])->assertOk()->assertJsonPath('ticket.status', 'in_progress');

        $this->assertDatabaseMissing('approval_requests', [
            'approvable_id' => $ticketId,
            'module' => 'service_desk',
        ]);
    }

    public function test_category_only_submission_still_requires_approval(): void
    {
        $this->seed();

        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        $ictAdmin = User::query()->where('email', 'samuel.eze@valtireo.test')->firstOrFail();

        Sanctum::actingAs($employeeUser);
        $ticketId = $this->postJson('/api/tickets', [
            'ticket_category_id' => $this->categoryId($employeeUser->organization_id, 'IT'),
            'subject' => 'No direct target',
            'description' => 'Should still require approval to find an owner.',
        ])->assertCreated()->assertJsonPath('ticket.status', 'submitted')->json('ticket.id');

        Sanctum::actingAs($ictAdmin);
        $this->patchJson("/api/tickets/{$ticketId}/start", [])->assertUnprocessable();
    }

    public function test_resolver_can_decline_a_ticket_sending_it_back_to_the_requester(): void
    {
        $this->seed();

        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        $ictAdmin = User::query()->where('email', 'samuel.eze@valtireo.test')->firstOrFail();

        Sanctum::actingAs($employeeUser);
        $ticketId = $this->postJson('/api/tickets', [
            'ticket_category_id' => $this->categoryId($employeeUser->organization_id, 'IT'),
            'subject' => 'Should be declined',
            'description' => 'Wrong category, needs to go elsewhere.',
            'assigned_to_user_id' => $ictAdmin->id,
        ])->assertCreated()->json('ticket.id');

        Sanctum::actingAs($ictAdmin);
        $this->patchJson("/api/tickets/{$ticketId}/decline", ['reason' => 'This is actually a facilities issue.'])
            ->assertOk()
            ->assertJsonPath('ticket.status', 'changes_requested');

        $this->assertDatabaseHas('ticket_comments', ['ticket_id' => $ticketId, 'comment' => 'This is actually a facilities issue.']);

        Sanctum::actingAs($employeeUser);
        $this->patchJson("/api/tickets/{$ticketId}/cancel")->assertOk()->assertJsonPath('ticket.status', 'cancelled');
    }

    public function test_decline_is_rejected_once_work_has_started(): void
    {
        $this->seed();

        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        $ictAdmin = User::query()->where('email', 'samuel.eze@valtireo.test')->firstOrFail();

        Sanctum::actingAs($employeeUser);
        $ticketId = $this->postJson('/api/tickets', [
            'ticket_category_id' => $this->categoryId($employeeUser->organization_id, 'IT'),
            'subject' => 'Already in progress',
            'description' => 'Too late to decline.',
            'assigned_to_user_id' => $ictAdmin->id,
        ])->assertCreated()->json('ticket.id');

        Sanctum::actingAs($ictAdmin);
        $this->patchJson("/api/tickets/{$ticketId}/start", [])->assertOk();

        $this->patchJson("/api/tickets/{$ticketId}/decline", ['reason' => 'Too late.'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['status']);
    }

    public function test_only_the_assignee_or_a_resolver_can_decline_a_ticket(): void
    {
        $this->seed();

        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        $ictAdmin = User::query()->where('email', 'samuel.eze@valtireo.test')->firstOrFail();
        $unrelatedEmployee = \App\Models\Employee::factory()->create(['organization_id' => $employeeUser->organization_id]);
        $unrelatedUser = User::factory()->create(['organization_id' => $employeeUser->organization_id]);
        $unrelatedEmployee->update(['user_id' => $unrelatedUser->id]);
        $employeeRole = \App\Models\Role::query()->where('organization_id', $employeeUser->organization_id)->where('key', 'employee')->firstOrFail();
        $this->setPermissionsTeamId($employeeUser->organization_id);
        $unrelatedUser->assignRole($employeeRole);

        Sanctum::actingAs($employeeUser);
        $ticketId = $this->postJson('/api/tickets', [
            'ticket_category_id' => $this->categoryId($employeeUser->organization_id, 'IT'),
            'subject' => 'Not yours to decline',
            'description' => 'An uninvolved employee should not be able to decline this.',
            'assigned_to_user_id' => $ictAdmin->id,
        ])->assertCreated()->json('ticket.id');

        Sanctum::actingAs($unrelatedUser);
        $this->patchJson("/api/tickets/{$ticketId}/decline", ['reason' => 'Not my call.'])->assertForbidden();
    }
}
