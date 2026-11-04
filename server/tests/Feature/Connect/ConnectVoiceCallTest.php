<?php

namespace Tests\Feature\Connect;

use App\Models\Department;
use App\Models\Designation;
use App\Models\Employee;
use App\Models\EmploymentType;
use App\Models\Organization;
use App\Models\OrganizationLocation;
use App\Models\OrganizationModule;
use App\Models\PlatformModule;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Tests\TestCase;

class ConnectVoiceCallTest extends TestCase
{
    use RefreshDatabase;

    private Organization $org;

    private User $host;

    private User $guest;

    private User $third;

    protected function setUp(): void
    {
        parent::setUp();
        $this->org = Organization::factory()->create();
        $module = PlatformModule::factory()->create(['key' => 'connect', 'is_active' => true, 'required_permission' => null]);
        OrganizationModule::create(['organization_id' => $this->org->id, 'platform_module_id' => $module->id, 'status' => 'active']);
        $this->host = $this->employee();
        $this->guest = $this->employee();
        $this->third = $this->employee();
        config(['connect.url' => 'wss://media.example.test', 'connect.api_key' => 'test-key', 'connect.api_secret' => 'test-secret']);
        Http::preventStrayRequests();
        Http::fake(['media.example.test/*' => fn () => Http::response([], 200)]);
        $this->actingAsInOrganization($this->host);
    }

    private function employee(?Organization $org = null): User
    {
        $org ??= $this->org;
        $user = User::factory()->create(['organization_id' => $org->id]);
        $references = [];
        foreach (['department_id' => Department::class, 'designation_id' => Designation::class, 'employment_type_id' => EmploymentType::class, 'organization_location_id' => OrganizationLocation::class] as $key => $class) {
            $references[$key] = $class::firstOrCreate(['organization_id' => $org->id, 'code' => 'CONNECT-VOICE-TEST'], ['name' => 'Connect voice test', 'is_active' => true])->id;
        }
        Employee::factory()->create([...$references, 'unit_id' => null, 'grade_level_id' => null, 'organization_id' => $org->id, 'user_id' => $user->id, 'status' => 'active']);

        return $user;
    }

    private function directWith(User $other): string
    {
        return $this->postJson('/api/connect/conversations', ['kind' => 'direct', 'member_ids' => [$other->id]])->assertCreated()->json('data.id');
    }

    public function test_an_incoming_call_pushes_to_the_callees_registered_device(): void
    {
        // Regression: ConnectChatService::notify() (shared by messages and
        // calls) used to bypass ValtireoNotification's channels entirely via a
        // raw notifications-table insert — an incoming call looked like it
        // notified, but never actually pushed.
        Http::fake([
            'media.example.test/*' => fn () => Http::response([], 200),
            'exp.host/*' => Http::response(['data' => []], 200),
        ]);
        \App\Models\DevicePushToken::query()->create(['user_id' => $this->guest->id, 'token' => 'ExponentPushToken[incoming-call]', 'platform' => 'ios']);

        $id = $this->directWith($this->guest);
        $this->postJson('/api/connect/calls', ['conversation_id' => $id])->assertCreated();

        Http::assertSent(function ($request) {
            if ($request->url() !== 'https://exp.host/--/api/v2/push/send') return false;
            $message = collect($request->data())->firstWhere('to', 'ExponentPushToken[incoming-call]');

            // The dedicated 'calls' Android channel + iOS time-sensitive interruption
            // level are what actually make this push break through Do Not Disturb /
            // Focus and show as a heads-up banner while the app is backgrounded —
            // without this, an incoming call was indistinguishable from any other
            // low-priority notification (e.g. a leave approval).
            return $message !== null
                && $message['channelId'] === 'calls'
                && $message['interruptionLevel'] === 'time-sensitive';
        });
    }

    public function test_calls_only_support_direct_conversations(): void
    {
        $groupId = $this->postJson('/api/connect/conversations', ['kind' => 'group', 'name' => 'Team', 'member_ids' => [$this->guest->id, $this->third->id]])->assertCreated()->json('data.id');
        $this->postJson('/api/connect/calls', ['conversation_id' => $groupId])->assertUnprocessable();
        Http::assertNothingSent();
    }

    public function test_callee_preferences_gate_incoming_calls(): void
    {
        $id = $this->directWith($this->guest);

        $this->actingAsInOrganization($this->guest);
        $this->patchJson('/api/connect/preferences', ['allow_calls' => false])->assertOk();
        $this->actingAsInOrganization($this->host);
        $this->postJson('/api/connect/calls', ['conversation_id' => $id])->assertStatus(409);

        $this->actingAsInOrganization($this->guest);
        $this->patchJson('/api/connect/preferences', ['allow_calls' => true, 'availability' => 'busy'])->assertOk();
        $this->actingAsInOrganization($this->host);
        $this->postJson('/api/connect/calls', ['conversation_id' => $id])->assertStatus(409);

        $this->actingAsInOrganization($this->guest);
        $this->patchJson('/api/connect/preferences', ['availability' => 'away'])->assertOk();
        $this->actingAsInOrganization($this->host);
        $this->postJson('/api/connect/calls', ['conversation_id' => $id])->assertCreated();
    }

    public function test_cannot_start_a_call_while_a_party_is_already_on_one(): void
    {
        $id = $this->directWith($this->guest);
        $this->postJson('/api/connect/calls', ['conversation_id' => $id])->assertCreated();

        $otherId = $this->directWith($this->third);
        $this->postJson('/api/connect/calls', ['conversation_id' => $otherId])->assertStatus(409);

        $this->actingAsInOrganization($this->guest);
        $thirdDirect = $this->postJson('/api/connect/conversations', ['kind' => 'direct', 'member_ids' => [$this->third->id]])->assertCreated()->json('data.id');
        $this->postJson('/api/connect/calls', ['conversation_id' => $thirdDirect])->assertStatus(409);
    }

    public function test_only_the_callee_can_accept_or_decline_and_credentials_are_room_scoped(): void
    {
        $id = $this->directWith($this->guest);
        $callId = $this->postJson('/api/connect/calls', ['conversation_id' => $id])->assertCreated()->json('data.id');
        $this->assertDatabaseHas('notifications', ['notifiable_id' => $this->guest->id]);

        $this->postJson("/api/connect/calls/{$callId}/actions", ['action' => 'accept'])->assertForbidden();
        $this->postJson("/api/connect/calls/{$callId}/actions", ['action' => 'join'])->assertStatus(409);

        $this->actingAsInOrganization($this->guest);
        $response = $this->postJson("/api/connect/calls/{$callId}/actions", ['action' => 'accept'])->assertOk();
        $this->assertSame('active', $response->json('data.status'));
        $credentials = $response->json('credentials');
        $this->assertNotNull($credentials);
        [, $body] = explode('.', $credentials['token']);
        $claims = json_decode(base64_decode(strtr($body, '-_', '+/')), true);
        $this->assertSame('connect-voice-'.$callId, $claims['video']['room']);
        $this->assertSame(['microphone'], $claims['video']['canPublishSources']);
        Http::assertSent(fn ($request) => str_ends_with($request->url(), '/CreateRoom') && $request['max_participants'] === 2);

        $this->actingAsInOrganization($this->host);
        $joinResponse = $this->postJson("/api/connect/calls/{$callId}/actions", ['action' => 'join'])->assertOk();
        $this->assertNotNull($joinResponse->json('credentials'));
    }

    public function test_decline_and_end_close_the_call_and_the_room(): void
    {
        $id = $this->directWith($this->guest);
        $callId = $this->postJson('/api/connect/calls', ['conversation_id' => $id])->assertCreated()->json('data.id');

        $this->actingAsInOrganization($this->guest);
        $this->postJson("/api/connect/calls/{$callId}/actions", ['action' => 'decline'])->assertOk()->assertJsonPath('data.status', 'declined');
        $this->assertDatabaseHas('connect_voice_calls', ['id' => $callId, 'status' => 'declined']);

        $this->actingAsInOrganization($this->host);
        $id2 = $this->directWith($this->third);
        $call2 = $this->postJson('/api/connect/calls', ['conversation_id' => $id2])->assertCreated()->json('data.id');
        $this->actingAsInOrganization($this->third);
        $this->postJson("/api/connect/calls/{$call2}/actions", ['action' => 'accept'])->assertOk();
        $this->postJson("/api/connect/calls/{$call2}/actions", ['action' => 'end'])->assertOk()->assertJsonPath('data.status', 'ended');
        Http::assertSent(fn ($request) => str_ends_with($request->url(), '/DeleteRoom'));
        $this->assertNotNull(\App\Models\ConnectVoiceCall::findOrFail($call2)->room_closed_at);
    }

    public function test_a_direct_conversation_with_only_a_call_appears_in_the_list_with_a_call_label(): void
    {
        // A conversation created just to place a call, with no message ever sent,
        // must still surface — unlike an opened-but-unused chat (see ConnectChatTest's
        // "hidden until a message is sent") — just labeled as a call, not blank.
        $id = $this->directWith($this->guest);
        $callId = $this->postJson('/api/connect/calls', ['conversation_id' => $id])->assertCreated()->json('data.id');

        $this->actingAsInOrganization($this->guest);
        $this->postJson("/api/connect/calls/{$callId}/actions", ['action' => 'decline'])->assertOk();

        $this->getJson('/api/connect/conversations')->assertOk()
            ->assertJsonFragment(['id' => $id])
            ->assertJsonPath('data.0.last_call.status', 'declined')
            ->assertJsonPath('data.0.last_call.label', 'You declined a call');

        $this->actingAsInOrganization($this->host);
        $this->getJson('/api/connect/conversations')->assertOk()
            ->assertJsonFragment(['id' => $id])
            ->assertJsonPath('data.0.last_call.status', 'declined')
            ->assertJsonPath('data.0.last_call.label', 'Call declined');
    }

    public function test_an_unanswered_call_expires_to_missed_and_notifies_the_callee(): void
    {
        $id = $this->directWith($this->guest);
        $callId = $this->postJson('/api/connect/calls', ['conversation_id' => $id])->assertCreated()->json('data.id');

        $this->travel(61)->seconds();
        $this->artisan('connect:reconcile-voice')->assertExitCode(0);
        $this->assertDatabaseHas('connect_voice_calls', ['id' => $callId, 'status' => 'missed']);
        $notifications = \Illuminate\Support\Facades\DB::table('notifications')->where('notifiable_id', $this->guest->id)->get();
        $this->assertCount(2, $notifications);
        $this->assertStringContainsString('connect.call.missed', $notifications->last()->data);

        $this->actingAsInOrganization($this->guest);
        $this->postJson("/api/connect/calls/{$callId}/actions", ['action' => 'accept'])->assertStatus(409);
    }

    public function test_reconciliation_ends_a_call_when_a_participant_or_subscription_becomes_invalid(): void
    {
        $id = $this->directWith($this->guest);
        $callId = $this->postJson('/api/connect/calls', ['conversation_id' => $id])->assertCreated()->json('data.id');
        $this->guest->employee->update(['status' => 'suspended']);
        $this->artisan('connect:reconcile-voice')->assertExitCode(0);
        $this->assertDatabaseHas('connect_voice_calls', ['id' => $callId, 'status' => 'ended']);

        $this->guest->employee->update(['status' => 'active']);
        $id2 = $this->directWith($this->third);
        $call2 = $this->postJson('/api/connect/calls', ['conversation_id' => $id2])->assertCreated()->json('data.id');
        OrganizationModule::where('organization_id', $this->org->id)->update(['status' => 'suspended']);
        $this->artisan('connect:reconcile-voice')->assertExitCode(0);
        $this->assertDatabaseHas('connect_voice_calls', ['id' => $call2, 'status' => 'ended']);
    }

    public function test_an_abandoned_active_call_is_ended_by_the_scheduled_sweep_once_the_room_is_empty(): void
    {
        $id = $this->directWith($this->guest);
        $callId = $this->postJson('/api/connect/calls', ['conversation_id' => $id])->assertCreated()->json('data.id');
        $this->actingAsInOrganization($this->guest);
        $this->postJson("/api/connect/calls/{$callId}/actions", ['action' => 'accept'])->assertOk();

        // Immediately after accepting, the grace period protects a callee whose
        // client just hasn't finished connecting to the room yet.
        $this->artisan('connect:reconcile-voice')->assertExitCode(0);
        $this->assertDatabaseHas('connect_voice_calls', ['id' => $callId, 'status' => 'active']);

        // Past the grace period, an empty room (the default fake ListParticipants
        // response — see setUp) means both sides are genuinely gone.
        $this->travel(21)->seconds();
        $this->artisan('connect:reconcile-voice')->assertExitCode(0);
        $this->assertDatabaseHas('connect_voice_calls', ['id' => $callId, 'status' => 'ended']);
        Http::assertSent(fn ($request) => str_ends_with($request->url(), '/ListParticipants'));
    }

    public function test_an_active_call_still_occupied_is_not_ended_by_the_scheduled_sweep(): void
    {
        $id = $this->directWith($this->guest);
        $callId = $this->postJson('/api/connect/calls', ['conversation_id' => $id])->assertCreated()->json('data.id');
        $this->actingAsInOrganization($this->guest);
        $this->postJson("/api/connect/calls/{$callId}/actions", ['action' => 'accept'])->assertOk();

        // Mocking the service boundary rather than re-faking Http mid-test:
        // setUp()'s own Http::fake() already owns the media.example.test/*
        // pattern for the rest of this test's lifetime (a later Http::fake()
        // call for the same pattern does not take over resolution order —
        // confirmed directly, not assumed), so a clean way to make only
        // ListParticipants answer differently here is to stub the method itself.
        $guestId = $this->guest->id;
        $this->partialMock(\App\Services\ConnectMediaService::class, function ($mock) use ($guestId) {
            $mock->shouldReceive('voiceParticipants')->andReturn([['identity' => 'user-'.$guestId]]);
        });

        $this->travel(21)->seconds();
        $this->artisan('connect:reconcile-voice')->assertExitCode(0);
        $this->assertDatabaseHas('connect_voice_calls', ['id' => $callId, 'status' => 'active']);
    }

    public function test_the_four_second_poll_path_never_pays_for_a_presence_check(): void
    {
        // The interactive path (GET /connect/calls, polled every ~4s while a
        // call is up) must stay cheap — only the once-a-minute scheduled sweep
        // opts into checking LiveKit at all. An empty room here must NOT end
        // the call, and ListParticipants must never even be called.
        $id = $this->directWith($this->guest);
        $callId = $this->postJson('/api/connect/calls', ['conversation_id' => $id])->assertCreated()->json('data.id');
        $this->actingAsInOrganization($this->guest);
        $this->postJson("/api/connect/calls/{$callId}/actions", ['action' => 'accept'])->assertOk();

        $this->travel(21)->seconds();
        $this->getJson('/api/connect/calls')->assertOk();
        $this->assertDatabaseHas('connect_voice_calls', ['id' => $callId, 'status' => 'active']);
        Http::assertNotSent(fn ($request) => str_ends_with($request->url(), '/ListParticipants'));
    }

    public function test_calls_are_private_to_their_two_participants(): void
    {
        $id = $this->directWith($this->guest);
        $callId = $this->postJson('/api/connect/calls', ['conversation_id' => $id])->assertCreated()->json('data.id');

        $this->actingAsInOrganization($this->third);
        $this->getJson('/api/connect/calls')->assertJsonMissing(['id' => $callId]);
        $this->postJson("/api/connect/calls/{$callId}/actions", ['action' => 'end'])->assertNotFound();
    }

    public function test_media_not_ready_blocks_new_calls_but_not_messaging(): void
    {
        $id = $this->directWith($this->guest);
        config(['connect.api_secret' => '']);
        $this->postJson('/api/connect/calls', ['conversation_id' => $id])->assertStatus(503);
        $this->postJson('/api/connect/conversations/'.$id.'/messages', ['client_id' => Str::uuid()->toString(), 'body' => 'Still works'])->assertCreated();
    }

    public function test_module_and_employee_status_are_enforced(): void
    {
        OrganizationModule::where('organization_id', $this->org->id)->update(['status' => 'suspended']);
        $this->getJson('/api/connect/calls')->assertForbidden();
        OrganizationModule::where('organization_id', $this->org->id)->update(['status' => 'active']);

        $this->host->employee->update(['status' => 'onboarding']);
        $this->getJson('/api/connect/calls')->assertForbidden();
    }
}
