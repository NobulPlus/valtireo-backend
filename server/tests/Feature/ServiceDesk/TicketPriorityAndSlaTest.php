<?php

namespace Tests\Feature\ServiceDesk;

use App\Models\Ticket;
use App\Models\TicketCategory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class TicketPriorityAndSlaTest extends TestCase
{
    use RefreshDatabase;

    private function categoryId(int $organizationId, string $code): int
    {
        return TicketCategory::query()
            ->where('organization_id', $organizationId)
            ->where('code', $code)
            ->value('id');
    }

    public function test_ticket_defaults_to_medium_priority_and_validates_allowed_values(): void
    {
        $this->seed();

        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        Sanctum::actingAs($employeeUser);

        $this->postJson('/api/tickets', [
            'ticket_category_id' => $this->categoryId($employeeUser->organization_id, 'IT'),
            'subject' => 'No priority given',
            'description' => 'Should default to medium.',
        ])->assertCreated()->assertJsonPath('ticket.priority', 'medium');

        $this->postJson('/api/tickets', [
            'ticket_category_id' => $this->categoryId($employeeUser->organization_id, 'IT'),
            'subject' => 'Bad priority',
            'description' => 'Should fail validation.',
            'priority' => 'catastrophic',
        ])->assertUnprocessable()->assertJsonValidationErrors(['priority']);
    }

    public function test_resolver_can_change_ticket_priority(): void
    {
        $this->seed();

        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        $ictAdmin = User::query()->where('email', 'samuel.eze@valtireo.test')->firstOrFail();

        Sanctum::actingAs($employeeUser);
        $ticketId = $this->postJson('/api/tickets', [
            'ticket_category_id' => $this->categoryId($employeeUser->organization_id, 'IT'),
            'subject' => 'Priority change test',
            'description' => 'Testing priority update.',
        ])->assertCreated()->json('ticket.id');

        Sanctum::actingAs($ictAdmin);
        $this->patchJson("/api/tickets/{$ticketId}/priority", ['priority' => 'urgent'])
            ->assertOk()
            ->assertJsonPath('ticket.priority', 'urgent');

        Sanctum::actingAs($employeeUser);
        $this->patchJson("/api/tickets/{$ticketId}/priority", ['priority' => 'low'])->assertForbidden();
    }

    public function test_sla_due_at_is_computed_from_category_resolution_hours_and_null_without_one(): void
    {
        $this->seed();

        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        $itCategoryId = $this->categoryId($employeeUser->organization_id, 'IT');
        $otherCategoryId = $this->categoryId($employeeUser->organization_id, 'OTHER');

        TicketCategory::query()->whereKey($itCategoryId)->update(['resolution_sla_hours' => 24]);

        Sanctum::actingAs($employeeUser);

        $withSla = $this->postJson('/api/tickets', [
            'ticket_category_id' => $itCategoryId,
            'subject' => 'Has an SLA',
            'description' => 'Category carries a 24h resolution SLA.',
        ])->assertCreated()->json('ticket');

        $this->assertNotNull($withSla['sla_due_at']);
        $ticket = Ticket::query()->findOrFail($withSla['id']);
        $this->assertEqualsWithDelta(
            $ticket->submitted_at->addHours(24)->getTimestamp(),
            $ticket->sla_due_at->getTimestamp(),
            2,
        );

        $withoutSla = $this->postJson('/api/tickets', [
            'ticket_category_id' => $otherCategoryId,
            'subject' => 'No SLA on this category',
            'description' => 'OTHER has no configured SLA.',
        ])->assertCreated()->json('ticket');

        $this->assertNull($withoutSla['sla_due_at']);
    }

    public function test_sla_breach_reminder_notifies_assignee_once_and_never_for_resolved_tickets(): void
    {
        $this->seed();

        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        $ictAdmin = User::query()->where('email', 'samuel.eze@valtireo.test')->firstOrFail();
        $itCategoryId = $this->categoryId($employeeUser->organization_id, 'IT');
        TicketCategory::query()->whereKey($itCategoryId)->update(['resolution_sla_hours' => 1]);

        Sanctum::actingAs($employeeUser);
        $ticketId = $this->postJson('/api/tickets', [
            'ticket_category_id' => $itCategoryId,
            'subject' => 'Will breach SLA',
            'description' => 'Should notify once breached.',
        ])->assertCreated()->json('ticket.id');

        Sanctum::actingAs($ictAdmin);
        $this->patchJson("/api/tickets/{$ticketId}/assign", ['assigned_to_user_id' => $ictAdmin->id])->assertOk();

        $this->travelTo(now()->addHours(3));

        Artisan::call('valtireo:send-reminders');
        $this->assertSame(
            1,
            DB::table('notifications')
                ->where('notifiable_id', $ictAdmin->id)
                ->where('data->metadata->reminder_key', "sla_breach:{$ticketId}")
                ->count(),
        );

        // Running again must not send a duplicate for the same breach.
        Artisan::call('valtireo:send-reminders');
        $this->assertSame(
            1,
            DB::table('notifications')
                ->where('notifiable_id', $ictAdmin->id)
                ->where('data->metadata->reminder_key', "sla_breach:{$ticketId}")
                ->count(),
        );

        $approval = \App\Models\ApprovalRequest::query()->where('approvable_id', $ticketId)->where('module', 'service_desk')->firstOrFail();
        $this->postJson("/api/approvals/{$approval->id}/actions", ['action' => 'approve'])->assertOk();
        $this->patchJson("/api/tickets/{$ticketId}/resolve", [])->assertOk();

        DB::table('notifications')
            ->where('notifiable_id', $ictAdmin->id)
            ->where('data->metadata->reminder_key', "sla_breach:{$ticketId}")
            ->delete();

        Artisan::call('valtireo:send-reminders');
        $this->assertSame(
            0,
            DB::table('notifications')
                ->where('notifiable_id', $ictAdmin->id)
                ->where('data->metadata->reminder_key', "sla_breach:{$ticketId}")
                ->count(),
        );
    }
}
