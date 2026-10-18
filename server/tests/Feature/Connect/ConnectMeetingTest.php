<?php

namespace Tests\Feature\Connect;

use App\Models\ConnectMeeting;
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
use Tests\TestCase;

class ConnectMeetingTest extends TestCase
{
    use RefreshDatabase;

    private Organization $org;

    private User $host;

    private User $guest;

    private User $outsider;

    private int $mediaStatus = 200;

    private array $mediaParticipants = [];

    protected function setUp(): void
    {
        parent::setUp();
        $this->org = Organization::factory()->create();
        $module = PlatformModule::factory()->create(['key' => 'connect', 'is_active' => true, 'required_permission' => null]);
        OrganizationModule::create(['organization_id' => $this->org->id, 'platform_module_id' => $module->id, 'status' => 'active']);
        $this->host = $this->employee();
        $this->guest = $this->employee();
        $this->outsider = $this->employee();
        config(['connect.url' => 'wss://media.example.test', 'connect.api_key' => 'test-key', 'connect.api_secret' => 'test-secret']);
        Http::preventStrayRequests();
        Http::fake(['media.example.test/*' => fn ($request) => Http::response(str_ends_with($request->url(), '/ListParticipants') ? ['participants' => $this->mediaParticipants] : [], $this->mediaStatus)]);
        $this->actingAsInOrganization($this->host);
    }

    private function employee(?Organization $org = null): User
    {
        $org ??= $this->org;
        $user = User::factory()->create(['organization_id' => $org->id]);
        $references = [];
        foreach (['department_id' => Department::class, 'designation_id' => Designation::class, 'employment_type_id' => EmploymentType::class, 'organization_location_id' => OrganizationLocation::class] as $key => $class) {
            $references[$key] = $class::firstOrCreate(['organization_id' => $org->id, 'code' => 'CONNECT-TEST'], ['name' => 'Connect test', 'is_active' => true])->id;
        }
        Employee::factory()->create([...$references, 'unit_id' => null, 'grade_level_id' => null, 'organization_id' => $org->id, 'user_id' => $user->id, 'status' => 'active']);

        return $user;
    }

    private function create(array $extra = []): string
    {
        return $this->postJson('/api/connect/meetings', [...[
            'title' => 'Team check-in', 'duration_minutes' => 60, 'member_ids' => [$this->guest->id],
        ], ...$extra])->assertCreated()->assertJsonPath('data.status', 'scheduled')->json('data.id');
    }

    public function test_invitations_and_meetings_are_private_even_within_an_organization(): void
    {
        $id = $this->create();
        $this->assertDatabaseCount('notifications', 1);
        $this->getJson('/api/connect/meetings')->assertJsonCount(1, 'meetings.data');
        $this->actingAsInOrganization($this->outsider);
        $this->getJson('/api/connect/meetings')->assertJsonCount(0, 'meetings.data');
        $this->getJson('/api/connect/meetings/'.$id)->assertNotFound();
        $this->postJson('/api/connect/meetings/'.$id.'/join')->assertNotFound();
        $this->postJson('/api/connect/meetings/'.$id.'/end')->assertNotFound();
        $this->actingAsInOrganization($this->guest);
        $this->getJson('/api/connect/meetings/'.$id)->assertOk()->assertJsonPath('data.is_host', false);
        $this->postJson('/api/connect/meetings/'.$id.'/end')->assertForbidden();
    }

    public function test_only_host_starts_and_join_token_is_short_lived_room_scoped_and_signed(): void
    {
        $id = $this->create();
        $this->actingAsInOrganization($this->guest);
        $this->postJson('/api/connect/meetings/'.$id.'/join')->assertStatus(409);
        $this->actingAsInOrganization($this->host);
        $response = $this->postJson('/api/connect/meetings/'.$id.'/join')->assertOk();
        $this->assertStringContainsString('no-store', $response->headers->get('Cache-Control'));
        [$header, $body, $signature] = explode('.', $response->json('token'));
        $claims = json_decode(base64_decode(strtr($body, '-_', '+/')), true);
        $expected = rtrim(strtr(base64_encode(hash_hmac('sha256', $header.'.'.$body, 'test-secret', true)), '+/', '-_'), '=');
        $this->assertSame($expected, $signature);
        $this->assertSame('connect-'.$id, $claims['video']['room']);
        $this->assertSame('user-'.$this->host->id, $claims['sub']);
        $this->assertSame(60, $claims['exp'] - $claims['iat']);
        $this->assertArrayNotHasKey('roomAdmin', $claims['video']);
        $this->assertArrayNotHasKey('roomCreate', $claims['video']);
        Http::assertSent(fn ($request) => str_ends_with($request->url(), '/CreateRoom') && $request['max_participants'] === 25);
        $this->actingAsInOrganization($this->guest);
        $this->postJson('/api/connect/meetings/'.$id.'/join')->assertOk();
    }

    public function test_end_disconnects_room_blocks_new_tokens_and_can_be_retried_after_provider_failure(): void
    {
        $id = $this->create();
        $this->postJson('/api/connect/meetings/'.$id.'/join')->assertOk();
        $this->mediaStatus = 503;
        $this->postJson('/api/connect/meetings/'.$id.'/end')->assertStatus(503);
        $this->assertDatabaseHas('connect_meetings', ['id' => $id, 'status' => 'ended', 'room_closed_at' => null]);
        $this->postJson('/api/connect/meetings/'.$id.'/join')->assertStatus(409);
        $this->mediaStatus = 200;
        $this->postJson('/api/connect/meetings/'.$id.'/end')->assertOk()->assertJsonPath('data.room_close_pending', false);
        $this->assertNotNull(ConnectMeeting::findOrFail($id)->room_closed_at);
    }

    public function test_cancel_before_start_does_not_contact_media_and_cannot_join(): void
    {
        $id = $this->create();
        $this->postJson('/api/connect/meetings/'.$id.'/end')->assertOk()->assertJsonPath('data.status', 'cancelled');
        $this->postJson('/api/connect/meetings/'.$id.'/join')->assertStatus(409);
        Http::assertNothingSent();
    }

    public function test_cross_tenant_inactive_self_and_duplicate_invitations_are_rejected(): void
    {
        $other = $this->employee(Organization::factory()->create());
        foreach ([[$other->id], [$this->host->id], [$this->guest->id, $this->guest->id], []] as $ids) {
            $this->postJson('/api/connect/meetings', ['title' => 'Test', 'duration_minutes' => 60, 'member_ids' => $ids])->assertUnprocessable();
        }
        $this->guest->employee->update(['status' => 'suspended']);
        $this->postJson('/api/connect/meetings', ['title' => 'Test', 'duration_minutes' => 60, 'member_ids' => [$this->guest->id]])->assertUnprocessable();
        $this->getJson('/api/connect/people')->assertJsonMissing(['id' => $this->guest->id]);
    }

    public function test_module_and_employee_status_are_enforced(): void
    {
        $id = $this->create();
        OrganizationModule::where('organization_id', $this->org->id)->update(['status' => 'suspended']);
        $this->getJson('/api/connect/meetings')->assertForbidden();
        $this->postJson('/api/connect/meetings/'.$id.'/join')->assertForbidden();
        OrganizationModule::where('organization_id', $this->org->id)->update(['status' => 'active']);
        $this->actingAsInOrganization(User::factory()->create(['organization_id' => $this->org->id]));
        $this->getJson('/api/connect/people')->assertForbidden();
    }

    public function test_scheduling_window_expiry_and_missing_configuration(): void
    {
        $id = $this->create(['starts_at' => now()->addHour()->toIso8601String()]);
        $this->postJson('/api/connect/meetings/'.$id.'/join')->assertStatus(409);
        $this->travel(50)->minutes();
        config(['connect.api_secret' => '']);
        $this->getJson('/api/connect/meetings')->assertJsonPath('media_ready', false);
        $this->postJson('/api/connect/meetings/'.$id.'/join')->assertStatus(503);
        $this->assertDatabaseHas('connect_meetings', ['id' => $id, 'status' => 'scheduled']);
        config(['connect.api_secret' => 'test-secret']);
        $this->postJson('/api/connect/meetings/'.$id.'/join')->assertOk();
        $this->travel(2)->hours();
        $this->postJson('/api/connect/meetings/'.$id.'/join')->assertStatus(409);
    }

    public function test_reconciliation_closes_expired_calls_and_retries_a_media_failure(): void
    {
        $id = $this->create();
        $this->postJson('/api/connect/meetings/'.$id.'/join')->assertOk();
        $this->travel(61)->minutes();
        $this->mediaStatus = 503;
        $this->artisan('connect:reconcile')->assertExitCode(1);
        $this->assertDatabaseHas('connect_meetings', ['id' => $id, 'status' => 'ended', 'room_closed_at' => null]);
        $this->mediaStatus = 200;
        $this->artisan('connect:reconcile')->assertExitCode(0);
        $this->assertNotNull(ConnectMeeting::findOrFail($id)->room_closed_at);
    }

    public function test_reconciliation_removes_suspended_and_uninvited_participants_only(): void
    {
        $id = $this->create();
        $this->postJson('/api/connect/meetings/'.$id.'/join')->assertOk();
        $this->guest->employee->update(['status' => 'suspended']);
        $this->mediaParticipants = array_map(fn ($user) => ['identity' => 'user-'.$user->id], [$this->host, $this->guest, $this->outsider]);
        $this->artisan('connect:reconcile')->assertExitCode(0);
        Http::assertSent(fn ($request) => str_ends_with($request->url(), '/RemoveParticipant') && $request['identity'] === 'user-'.$this->guest->id);
        Http::assertSent(fn ($request) => str_ends_with($request->url(), '/RemoveParticipant') && $request['identity'] === 'user-'.$this->outsider->id);
        Http::assertNotSent(fn ($request) => str_ends_with($request->url(), '/RemoveParticipant') && $request['identity'] === 'user-'.$this->host->id);
        $this->assertDatabaseHas('connect_meetings', ['id' => $id, 'status' => 'live']);
    }

    public function test_reconciliation_closes_a_call_when_the_subscription_is_suspended(): void
    {
        $id = $this->create();
        $this->postJson('/api/connect/meetings/'.$id.'/join')->assertOk();
        OrganizationModule::where('organization_id', $this->org->id)->update(['status' => 'suspended']);
        $this->artisan('connect:reconcile')->assertExitCode(0);
        $this->assertDatabaseHas('connect_meetings', ['id' => $id, 'status' => 'ended']);
        $this->assertNotNull(ConnectMeeting::findOrFail($id)->room_closed_at);
    }

    public function test_reconciliation_closes_a_call_when_the_host_exits(): void
    {
        $id = $this->create();
        $this->postJson('/api/connect/meetings/'.$id.'/join')->assertOk();
        $this->host->employee->update(['status' => 'exited']);
        $this->artisan('connect:reconcile')->assertExitCode(0);
        $this->assertDatabaseHas('connect_meetings', ['id' => $id, 'status' => 'ended']);
        $this->assertNotNull(ConnectMeeting::findOrFail($id)->room_closed_at);
    }

    public function test_reconciliation_processes_expired_scheduled_meetings_across_chunks_without_media(): void
    {
        config(['connect.api_secret' => '']);
        for ($i = 0; $i < 105; $i++) {
            ConnectMeeting::create(['organization_id' => $this->org->id, 'host_user_id' => $this->host->id,
                'title' => 'Expired fixture', 'starts_at' => now()->subHours(2), 'ends_at' => now()->subHour()]);
        }
        $this->artisan('connect:reconcile')->assertExitCode(0);
        $this->assertSame(105, ConnectMeeting::where('status', 'cancelled')->count());
        Http::assertNothingSent();
    }
}
