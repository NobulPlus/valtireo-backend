<?php

namespace Tests\Feature\ServiceDesk;

use App\Models\TicketCategory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class TicketQueueAndReportingTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
    }

    private function categoryId(int $organizationId, string $code): int
    {
        return TicketCategory::query()
            ->where('organization_id', $organizationId)
            ->where('code', $code)
            ->value('id');
    }

    private function submitTicket(User $employeeUser, string $categoryCode = 'IT', string $priority = 'medium'): int
    {
        Sanctum::actingAs($employeeUser);

        return $this->postJson('/api/tickets', [
            'ticket_category_id' => $this->categoryId($employeeUser->organization_id, $categoryCode),
            'subject' => "Queue test ({$categoryCode}/{$priority})",
            'description' => 'Queue and reporting coverage.',
            'priority' => $priority,
        ])->assertCreated()->json('ticket.id');
    }

    public function test_index_filters_by_priority_and_assigned_to_user_id_including_unassigned(): void
    {
        $this->seed();

        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        $ictAdmin = User::query()->where('email', 'samuel.eze@valtireo.test')->firstOrFail();

        $highTicketId = $this->submitTicket($employeeUser, 'IT', 'high');
        $lowTicketId = $this->submitTicket($employeeUser, 'IT', 'low');

        Sanctum::actingAs($ictAdmin);
        $this->patchJson("/api/tickets/{$highTicketId}/assign", ['assigned_to_user_id' => $ictAdmin->id])->assertOk();

        $this->assertSame(
            [$highTicketId],
            $this->getJson('/api/tickets?priority=high')->assertOk()->json('data.*.id'),
        );

        $this->assertSame(
            [$highTicketId],
            $this->getJson("/api/tickets?assigned_to_user_id={$ictAdmin->id}")->assertOk()->json('data.*.id'),
        );

        $this->assertSame(
            [$lowTicketId],
            $this->getJson('/api/tickets?assigned_to_user_id=unassigned')->assertOk()->json('data.*.id'),
        );
    }

    public function test_reporting_endpoint_is_permission_gated_and_numerically_correct(): void
    {
        $this->seed();

        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();

        Sanctum::actingAs($employeeUser);
        $this->getJson('/api/tickets/reporting')->assertForbidden();

        $this->submitTicket($employeeUser, 'IT', 'high');
        $this->submitTicket($employeeUser, 'FACILITIES', 'low');
        $ticketToResolve = $this->submitTicket($employeeUser, 'IT', 'medium');

        $ictAdmin = User::query()->where('email', 'samuel.eze@valtireo.test')->firstOrFail();
        Sanctum::actingAs($ictAdmin);
        $approval = \App\Models\ApprovalRequest::query()->where('approvable_id', $ticketToResolve)->where('module', 'service_desk')->firstOrFail();
        $this->postJson("/api/approvals/{$approval->id}/actions", ['action' => 'approve'])->assertOk();
        $this->patchJson("/api/tickets/{$ticketToResolve}/resolve", [])->assertOk();

        Sanctum::actingAs($this->admin());
        $reporting = $this->getJson('/api/tickets/reporting')->assertOk()->json('data');

        $this->assertSame(1, $reporting['resolved_count']);
        $this->assertNotNull($reporting['average_resolution_hours']);

        $totalSubmitted = collect($reporting['volume_trend']['entries'])->sum('submitted');
        $this->assertSame(3, $totalSubmitted);

        $byCategory = collect($reporting['by_category'])->keyBy('name');
        $this->assertSame(2, $byCategory['IT']['total']);
        $this->assertSame(1, $byCategory['Facilities']['total']);

        $byPriority = collect($reporting['by_priority'])->keyBy('priority');
        $this->assertSame(1, $byPriority['high']['total']);
        $this->assertSame(1, $byPriority['low']['total']);
        $this->assertSame(1, $byPriority['medium']['total']);
    }

    public function test_ticket_log_report_is_listed_and_exports_csv(): void
    {
        $this->seed();

        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        $this->submitTicket($employeeUser, 'IT', 'urgent');

        Sanctum::actingAs($this->admin());

        $this->getJson('/api/reports')->assertOk()->assertJsonFragment(['key' => 'ticket_log']);

        $this->getJson('/api/reports/ticket_log')
            ->assertOk()
            ->assertJsonPath('report.key', 'ticket_log')
            ->assertJsonFragment(['priority' => 'urgent']);

        $response = $this->get('/api/reports/ticket_log/export');
        $response->assertOk();
        $response->assertHeader('content-type', 'text/csv; charset=UTF-8');

        $content = $response->streamedContent();
        $this->assertStringContainsString('urgent', $content);
    }

    public function test_employee_without_reports_permission_cannot_access_ticket_log(): void
    {
        $this->seed();

        Sanctum::actingAs(User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail());

        $this->getJson('/api/reports/ticket_log')->assertForbidden();
    }
}
