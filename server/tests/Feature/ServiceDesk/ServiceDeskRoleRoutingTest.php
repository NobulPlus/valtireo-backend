<?php

namespace Tests\Feature\ServiceDesk;

use App\Models\ApprovalRequest;
use App\Models\TicketCategory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ServiceDeskRoleRoutingTest extends TestCase
{
    use RefreshDatabase;

    private function categoryId(int $organizationId, string $code): int
    {
        return TicketCategory::query()
            ->where('organization_id', $organizationId)
            ->where('code', $code)
            ->value('id');
    }

    private function submitTicket(User $employeeUser, string $categoryCode): ApprovalRequest
    {
        Sanctum::actingAs($employeeUser);

        $ticketId = $this->postJson('/api/tickets', [
            'ticket_category_id' => $this->categoryId($employeeUser->organization_id, $categoryCode),
            'subject' => "Routing test ({$categoryCode})",
            'description' => 'Verifying role-based routing.',
        ])->assertCreated()->json('ticket.id');

        return ApprovalRequest::query()->where('approvable_id', $ticketId)->where('module', 'service_desk')->firstOrFail();
    }

    public function test_it_tickets_route_to_the_ict_admin_role_only(): void
    {
        $this->seed();

        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        $ictAdmin = User::query()->where('email', 'samuel.eze@valtireo.test')->firstOrFail();
        $hrOfficer = User::query()->where('email', 'kelechi.nwosu@valtireo.test')->firstOrFail();

        $approval = $this->submitTicket($employeeUser, 'IT');

        Sanctum::actingAs($hrOfficer);
        $this->postJson("/api/approvals/{$approval->id}/actions", ['action' => 'approve'])->assertForbidden();

        Sanctum::actingAs($ictAdmin);
        $this->postJson("/api/approvals/{$approval->id}/actions", ['action' => 'approve'])->assertOk();
    }

    public function test_hr_policy_tickets_route_to_the_hr_officer_role_only(): void
    {
        $this->seed();

        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        $ictAdmin = User::query()->where('email', 'samuel.eze@valtireo.test')->firstOrFail();
        $hrOfficer = User::query()->where('email', 'kelechi.nwosu@valtireo.test')->firstOrFail();

        $approval = $this->submitTicket($employeeUser, 'HR_POLICY');

        Sanctum::actingAs($ictAdmin);
        $this->postJson("/api/approvals/{$approval->id}/actions", ['action' => 'approve'])->assertForbidden();

        Sanctum::actingAs($hrOfficer);
        $this->postJson("/api/approvals/{$approval->id}/actions", ['action' => 'approve'])->assertOk();
    }

    public function test_facilities_tickets_stay_on_the_generic_permission_pool(): void
    {
        $this->seed();

        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        $ictAdmin = User::query()->where('email', 'samuel.eze@valtireo.test')->firstOrFail();

        $approval = $this->submitTicket($employeeUser, 'FACILITIES');

        Sanctum::actingAs($ictAdmin);
        $this->postJson("/api/approvals/{$approval->id}/actions", ['action' => 'approve'])->assertOk();
    }
}
