<?php

namespace Tests\Feature\Notifications;

use App\Models\DevicePushToken;
use App\Models\User;
use App\Notifications\ValtireoNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class DevicePushTokenTest extends TestCase
{
    use RefreshDatabase;

    public function test_employee_can_register_a_push_token(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $this->postJson('/api/push-tokens', ['token' => 'ExponentPushToken[abc123]', 'platform' => 'android'])
            ->assertOk();

        $this->assertDatabaseHas('device_push_tokens', [
            'user_id' => $user->id,
            'token' => 'ExponentPushToken[abc123]',
            'platform' => 'android',
        ]);
    }

    public function test_registering_an_existing_token_reassigns_it_instead_of_colliding(): void
    {
        $previousOwner = User::factory()->create();
        DevicePushToken::query()->create([
            'user_id' => $previousOwner->id,
            'token' => 'ExponentPushToken[shared-device]',
            'platform' => 'ios',
        ]);

        $newOwner = User::factory()->create();
        Sanctum::actingAs($newOwner);

        $this->postJson('/api/push-tokens', ['token' => 'ExponentPushToken[shared-device]', 'platform' => 'ios'])
            ->assertOk();

        $this->assertSame(1, DevicePushToken::query()->where('token', 'ExponentPushToken[shared-device]')->count());
        $this->assertDatabaseHas('device_push_tokens', [
            'token' => 'ExponentPushToken[shared-device]',
            'user_id' => $newOwner->id,
        ]);
    }

    public function test_employee_can_remove_their_push_token_on_logout(): void
    {
        $user = User::factory()->create();
        DevicePushToken::query()->create(['user_id' => $user->id, 'token' => 'ExponentPushToken[gone]', 'platform' => 'android']);
        Sanctum::actingAs($user);

        $this->deleteJson('/api/push-tokens', ['token' => 'ExponentPushToken[gone]'])->assertOk();

        $this->assertDatabaseMissing('device_push_tokens', ['token' => 'ExponentPushToken[gone]']);
    }

    public function test_a_dispatched_notification_pushes_to_every_registered_device(): void
    {
        Http::fake(['exp.host/*' => Http::response(['data' => []], 200)]);

        $user = User::factory()->create();
        DevicePushToken::query()->create(['user_id' => $user->id, 'token' => 'ExponentPushToken[one]', 'platform' => 'ios']);
        DevicePushToken::query()->create(['user_id' => $user->id, 'token' => 'ExponentPushToken[two]', 'platform' => 'android']);

        $user->notify(new ValtireoNotification([
            'category' => 'connect',
            'event' => 'connect.message_received',
            'title' => 'New message',
            'message' => 'Olumide: How you doing',
            'action_url' => '/connect/chat/some-conversation-id',
            'entity_type' => 'connect_conversation',
            'entity_id' => null,
        ]));

        Http::assertSent(function ($request) {
            $tokens = array_column($request->data(), 'to');
            return $request->url() === 'https://exp.host/--/api/v2/push/send'
                && in_array('ExponentPushToken[one]', $tokens, true)
                && in_array('ExponentPushToken[two]', $tokens, true)
                && $request->data()[0]['title'] === 'New message';
        });
    }

    public function test_a_user_with_no_registered_devices_never_triggers_a_push_request(): void
    {
        Http::fake();

        $user = User::factory()->create();
        $user->notify(new ValtireoNotification([
            'category' => 'general',
            'event' => 'notification.created',
            'title' => 'Hello',
            'message' => 'World',
        ]));

        Http::assertNothingSent();
    }
}
