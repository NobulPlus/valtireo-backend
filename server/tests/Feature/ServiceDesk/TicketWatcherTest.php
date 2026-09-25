<?php

namespace Tests\Feature\ServiceDesk;

use App\Models\TicketCategory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class TicketWatcherTest extends TestCase
{
    use RefreshDatabase;

    private function submitTicket(User $employeeUser): int
    {
        Sanctum::actingAs($employeeUser);

        $categoryId = TicketCategory::query()
            ->where('organization_id', $employeeUser->organization_id)
            ->where('code', 'IT')
            ->value('id');

        return $this->postJson('/api/tickets', [
            'ticket_category_id' => $categoryId,
            'subject' => 'Watcher test',
            'description' => 'Testing ticket watchers.',
        ])->assertCreated()->json('ticket.id');
    }

    public function test_user_can_watch_and_unwatch_visible_ticket(): void
    {
        $this->seed();

        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        $ictAdmin = User::query()->where('email', 'samuel.eze@valtireo.test')->firstOrFail();
        $ticketId = $this->submitTicket($employeeUser);

        Sanctum::actingAs($ictAdmin);

        $watchResponse = $this->postJson("/api/tickets/{$ticketId}/watch")
            ->assertOk();

        $this->assertContains($ictAdmin->id, collect($watchResponse->json('ticket.watchers'))->pluck('user.id'));

        $this->assertDatabaseHas('ticket_watchers', [
            'ticket_id' => $ticketId,
            'user_id' => $ictAdmin->id,
        ]);

        $unwatchResponse = $this->deleteJson("/api/tickets/{$ticketId}/watch")
            ->assertOk();

        $this->assertNotContains($ictAdmin->id, collect($unwatchResponse->json('ticket.watchers'))->pluck('user.id'));

        $this->assertDatabaseMissing('ticket_watchers', [
            'ticket_id' => $ticketId,
            'user_id' => $ictAdmin->id,
        ]);
    }
}
