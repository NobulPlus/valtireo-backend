<?php

namespace Tests\Feature\ServiceDesk;

use App\Models\ApprovalRequest;
use App\Models\TicketCategory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ServiceDeskCategoryRoutingTest extends TestCase
{
    use RefreshDatabase;

    private function categoryId(int $organizationId, string $code): int
    {
        return TicketCategory::query()
            ->where('organization_id', $organizationId)
            ->where('code', $code)
            ->value('id');
    }

    public function test_ticket_routes_to_the_workflow_matching_its_category_code(): void
    {
        $this->seed();

        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        Sanctum::actingAs($employeeUser);

        $ticketId = $this->postJson('/api/tickets', [
            'ticket_category_id' => $this->categoryId($employeeUser->organization_id, 'FACILITIES'),
            'subject' => 'Broken aircon',
            'description' => 'The aircon in the meeting room is broken.',
        ])->assertCreated()->json('ticket.id');

        $this->assertDatabaseHas('approval_requests', [
            'approvable_id' => $ticketId,
            'module' => 'service_desk',
            'action' => 'facilities',
            'status' => 'pending',
        ]);
    }

    public function test_admin_created_category_and_workflow_route_correctly_on_next_submission(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        Sanctum::actingAs($admin);

        $categoryId = $this->postJson('/api/tickets/categories', [
            'name' => 'Security',
            'code' => 'security',
        ])->assertCreated()->json('data.id');

        $this->postJson('/api/approval-workflows', [
            'module' => 'service_desk',
            'action' => 'security',
            'name' => 'Security ticket review',
            'steps' => [
                [
                    'step_order' => 1,
                    'name' => 'Security review',
                    'approver_type' => 'permission',
                    'approver_permission' => 'service_desk.view',
                ],
            ],
        ])->assertCreated();

        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        Sanctum::actingAs($employeeUser);

        $ticketId = $this->postJson('/api/tickets', [
            'ticket_category_id' => $categoryId,
            'subject' => 'Lost badge',
            'description' => 'I lost my access badge.',
        ])->assertCreated()->json('ticket.id');

        $this->assertDatabaseHas('approval_requests', [
            'approvable_id' => $ticketId,
            'module' => 'service_desk',
            'action' => 'security',
            'status' => 'pending',
        ]);
    }
}
