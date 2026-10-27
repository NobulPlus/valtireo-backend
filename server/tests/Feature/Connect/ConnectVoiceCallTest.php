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
