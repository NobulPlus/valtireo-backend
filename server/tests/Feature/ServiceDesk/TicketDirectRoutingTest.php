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

        Sanctum::actingAs($employeeUser);
        $response = $this->getJson('/api/tickets/resolvers')->assertOk()->json('data');

        $this->assertFalse($employeeUser->can('service_desk.view'));

        $this->assertNotEmpty($response);
        $ictResolver = collect($response)->firstWhere('email', 'samuel.eze@valtireo.test');
        $this->assertNotNull($ictResolver);
        $this->assertSame('ICT', $ictResolver['department']['name'] ?? null);
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
            ->assertJsonPath('ticket.assigned_to.id', $ictAdmin->id);

        $this->assertDatabaseHas('notifications', [
            'notifiable_id' => $ictAdmin->id,
            'data->event' => 'ticket.assigned',
        ]);
    }

    public function test_assigning_to_a_user_without_service_desk_access_is_rejected(): void
    {
        $this->seed();

        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();

        $otherEmployee = \App\Models\Employee::factory()->create(['organization_id' => $employeeUser->organization_id]);
        $otherEmployeeUser = User::factory()->create(['organization_id' => $employeeUser->organization_id]);
        $otherEmployee->update(['user_id' => $otherEmployeeUser->id]);
        $employeeRole = \App\Models\Role::query()->where('organization_id', $employeeUser->organization_id)->where('key', 'employee')->firstOrFail();
        $this->actingAsInOrganization($otherEmployeeUser);
        $otherEmployeeUser->assignRole($employeeRole);

        Sanctum::actingAs($employeeUser);
        $this->postJson('/api/tickets', [
            'ticket_category_id' => $this->categoryId($employeeUser->organization_id, 'IT'),
            'subject' => 'Should fail',
            'description' => 'Target has no service desk access.',
            'assigned_to_user_id' => $otherEmployeeUser->id,
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['assigned_to_user_id']);
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
}
