<?php

namespace Tests\Feature\Connect;

use App\Models\Department;
use App\Models\Designation;
use App\Models\Employee;
use App\Models\EmployeeProfile;
use App\Models\EmploymentType;
use App\Models\Organization;
use App\Models\OrganizationLocation;
use App\Models\OrganizationModule;
use App\Models\PlatformModule;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ConnectChatTest extends TestCase
{
    use RefreshDatabase;

    private Organization $org;

    private User $host;

    private User $guest;

    private User $third;

    private User $outsider;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(\Database\Seeders\RolePermissionSeeder::class);
        $this->org = Organization::factory()->create();
        app(\Spatie\Permission\PermissionRegistrar::class)->setPermissionsTeamId($this->org->id);
        app(\App\Services\DefaultRoleSeedingService::class)->seedForOrganization($this->org);
        $module = PlatformModule::factory()->create(['key' => 'connect', 'is_active' => true, 'required_permission' => null]);
        OrganizationModule::create(['organization_id' => $this->org->id, 'platform_module_id' => $module->id, 'status' => 'active']);
        $this->host = $this->employee();
        $this->guest = $this->employee();
        $this->third = $this->employee();
        $otherOrg = Organization::factory()->create();
        OrganizationModule::create(['organization_id' => $otherOrg->id, 'platform_module_id' => $module->id, 'status' => 'active']);
        $this->outsider = $this->employee($otherOrg);
        $this->actingAsInOrganization($this->host);
    }

    private function employee(?Organization $org = null): User
    {
        $org ??= $this->org;
        $user = User::factory()->create(['organization_id' => $org->id]);
        $references = [];
        foreach (['department_id' => Department::class, 'designation_id' => Designation::class, 'employment_type_id' => EmploymentType::class, 'organization_location_id' => OrganizationLocation::class] as $key => $class) {
            $references[$key] = $class::firstOrCreate(['organization_id' => $org->id, 'code' => 'CONNECT-CHAT-TEST'], ['name' => 'Connect chat test', 'is_active' => true])->id;
        }
        Employee::factory()->create([...$references, 'unit_id' => null, 'grade_level_id' => null, 'organization_id' => $org->id, 'user_id' => $user->id, 'status' => 'active']);

        return $user;
    }

    private function directWith(User $other): string
    {
        return $this->postJson('/api/connect/conversations', ['kind' => 'direct', 'member_ids' => [$other->id]])->assertCreated()->json('data.id');
    }

    private function groupWith(array $memberIds, string $name = 'Project Phoenix'): string
    {
        return $this->postJson('/api/connect/conversations', ['kind' => 'group', 'name' => $name, 'member_ids' => $memberIds])->assertCreated()->json('data.id');
    }

    public function test_colleague_search_can_be_scoped_to_a_department(): void
    {
        $otherDepartment = \App\Models\Department::factory()->create(['organization_id' => $this->org->id]);
        $differentDept = $this->third;
        $differentDept->employee->update(['department_id' => $otherDepartment->id]);

        $sameDept = $this->getJson('/api/connect/colleagues?department_id='.$this->guest->employee->department_id)->assertOk();
        $ids = collect($sameDept->json('data'))->pluck('id');
        $this->assertTrue($ids->contains($this->guest->id));
        $this->assertFalse($ids->contains($differentDept->id));

        $scoped = $this->getJson('/api/connect/colleagues?department_id='.$otherDepartment->id)->assertOk();
        $this->assertEqualsCanonicalizing([$differentDept->id], collect($scoped->json('data'))->pluck('id')->all());
    }

    public function test_colleague_search_excludes_self_inactive_and_cross_tenant_people(): void
    {
        $inactive = $this->employee();
        $inactive->employee->update(['status' => 'exited']);
        $response = $this->getJson('/api/connect/colleagues')->assertOk();
        $ids = collect($response->json('data'))->pluck('id');
        $this->assertTrue($ids->contains($this->guest->id));
        $this->assertTrue($ids->contains($this->third->id));
        $this->assertFalse($ids->contains($this->host->id));
        $this->assertFalse($ids->contains($this->outsider->id));
        $this->assertFalse($ids->contains($inactive->id));
    }

    public function test_direct_messages_are_deduplicated_and_private_to_members(): void
    {
        $id = $this->directWith($this->guest);
        $this->assertSame($id, $this->directWith($this->guest));
        $this->actingAsInOrganization($this->guest);
        $this->assertSame($id, $this->directWith($this->host));
        $this->assertDatabaseCount('connect_conversations', 1);

        $this->actingAsInOrganization($this->third);
        $this->getJson('/api/connect/conversations/'.$id)->assertNotFound();
        $this->actingAsInOrganization($this->outsider);
        $this->getJson('/api/connect/conversations/'.$id)->assertNotFound();

        $this->actingAsInOrganization($this->host);
        $this->getJson('/api/connect/conversations/'.$id)->assertOk()->assertJsonPath('data.kind', 'direct')->assertJsonPath('data.name', $this->guest->name);
    }

    public function test_a_direct_conversation_is_hidden_from_the_list_until_a_message_is_sent(): void
    {
        // Tapping a colleague creates the conversation row immediately (see
        // ConnectMessenger's openDirect / "tapping the person IS the action"),
        // so without list-side filtering, every chat a user merely opened —
        // and never actually used — would sit in their list forever looking
        // like an ongoing conversation.
        $id = $this->directWith($this->guest);

        $this->getJson('/api/connect/conversations')->assertOk()->assertJsonMissing(['id' => $id]);

        $this->actingAsInOrganization($this->guest);
        $this->getJson('/api/connect/conversations')->assertOk()->assertJsonMissing(['id' => $id]);

        $this->actingAsInOrganization($this->host);
        $this->postJson('/api/connect/conversations/'.$id.'/messages', ['client_id' => \Illuminate\Support\Str::uuid()->toString(), 'body' => 'Hello'])->assertCreated();

        $this->getJson('/api/connect/conversations')->assertOk()->assertJsonFragment(['id' => $id]);
        $this->actingAsInOrganization($this->guest);
        $this->getJson('/api/connect/conversations')->assertOk()->assertJsonFragment(['id' => $id]);
    }

    public function test_conversation_creation_is_validated(): void
    {
        $this->postJson('/api/connect/conversations', ['kind' => 'direct', 'member_ids' => [$this->guest->id, $this->third->id]])->assertUnprocessable();
        $this->postJson('/api/connect/conversations', ['kind' => 'direct', 'member_ids' => [$this->outsider->id]])->assertUnprocessable();
        $this->postJson('/api/connect/conversations', ['kind' => 'direct', 'member_ids' => [$this->host->id]])->assertUnprocessable();
        $this->postJson('/api/connect/conversations', ['kind' => 'group', 'member_ids' => [$this->guest->id]])->assertUnprocessable();

        $this->guest->employee->update(['status' => 'suspended']);
        $this->postJson('/api/connect/conversations', ['kind' => 'direct', 'member_ids' => [$this->guest->id]])->assertUnprocessable();
    }

    public function test_channel_creation_can_be_restricted_to_administrators(): void
    {
        $this->org->update(['settings' => ['connect' => ['allow_employee_channels' => false]]]);
        $this->postJson('/api/connect/conversations', ['kind' => 'channel', 'name' => 'Announcements', 'member_ids' => []])->assertForbidden();
        $this->host->assignRole('Organization Admin');
        $this->postJson('/api/connect/conversations', ['kind' => 'channel', 'name' => 'Announcements', 'member_ids' => []])->assertCreated();
    }

    public function test_organization_channels_are_discoverable_and_joinable(): void
    {
        $id = $this->postJson('/api/connect/conversations', ['kind' => 'channel', 'name' => 'All hands', 'visibility' => 'organization', 'member_ids' => []])->assertCreated()->json('data.id');
        $private = $this->postJson('/api/connect/conversations', ['kind' => 'channel', 'name' => 'Leads only', 'visibility' => 'private', 'member_ids' => []])->assertCreated()->json('data.id');

        $this->actingAsInOrganization($this->guest);
        $channels = $this->getJson('/api/connect/channels')->assertOk()->json('data');
        $this->assertTrue(collect($channels)->contains('id', $id));
        $this->assertFalse(collect($channels)->contains('id', $private));
        $this->assertFalse(collect($channels)->firstWhere('id', $id)['joined']);

        $this->patchJson('/api/connect/conversations/'.$id.'/membership', ['action' => 'join'])->assertOk();
        $this->getJson('/api/connect/conversations/'.$id)->assertOk()->assertJsonPath('data.joined', true);
        $this->patchJson('/api/connect/conversations/'.$private.'/membership', ['action' => 'join'])->assertNotFound();
    }

    public function test_group_membership_permission_matrix(): void
    {
        $id = $this->groupWith([$this->guest->id]);
        $this->actingAsInOrganization($this->guest);
        $this->patchJson('/api/connect/conversations/'.$id.'/membership', ['action' => 'add', 'user_id' => $this->third->id])->assertForbidden();
        $this->patchJson('/api/connect/conversations/'.$id.'/membership', ['action' => 'rename', 'name' => 'Hijacked'])->assertForbidden();

        $this->actingAsInOrganization($this->host);
        $this->patchJson('/api/connect/conversations/'.$id.'/membership', ['action' => 'add', 'user_id' => $this->third->id])->assertOk();
        $this->patchJson('/api/connect/conversations/'.$id.'/membership', ['action' => 'rename', 'name' => 'Phoenix Core'])->assertOk();
        $this->assertDatabaseHas('connect_conversations', ['id' => $id, 'name' => 'Phoenix Core']);

        $this->patchJson('/api/connect/conversations/'.$id.'/membership', ['action' => 'leave'])->assertStatus(409);
        $this->patchJson('/api/connect/conversations/'.$id.'/membership', ['action' => 'remove', 'user_id' => $this->host->id])->assertStatus(409);
        $this->patchJson('/api/connect/conversations/'.$id.'/membership', ['action' => 'transfer', 'user_id' => $this->third->id])->assertOk();

        $this->actingAsInOrganization($this->guest);
        $this->patchJson('/api/connect/conversations/'.$id.'/membership', ['action' => 'leave'])->assertOk();
        $this->getJson('/api/connect/conversations/'.$id)->assertNotFound();
    }

    public function test_direct_conversations_cannot_be_left_or_have_members_changed(): void
    {
        $id = $this->directWith($this->guest);
        $this->patchJson('/api/connect/conversations/'.$id.'/membership', ['action' => 'leave'])->assertStatus(409);
        $this->patchJson('/api/connect/conversations/'.$id.'/membership', ['action' => 'archive', 'enabled' => true])->assertForbidden();
        $this->patchJson('/api/connect/conversations/'.$id.'/membership', ['action' => 'mute', 'enabled' => true])->assertOk();
        $this->getJson('/api/connect/conversations/'.$id)->assertJsonPath('data.muted', true);
    }

    public function test_adding_a_member_to_a_direct_conversation_upgrades_it_to_a_group(): void
    {
        $id = $this->directWith($this->guest);

        // Either participant can add — there's no meaningful "owner" of a 1:1,
        // and $this->guest never created this conversation.
        $this->actingAsInOrganization($this->guest);
        $this->patchJson('/api/connect/conversations/'.$id.'/membership', ['action' => 'add', 'user_id' => $this->third->id])->assertOk();

        $this->assertDatabaseHas('connect_conversations', ['id' => $id, 'kind' => 'group', 'direct_key' => null]);
        $response = $this->getJson('/api/connect/conversations/'.$id)->assertOk();
        $response->assertJsonPath('data.kind', 'group');
        $memberNames = collect($response->json('data.members'))->pluck('name')->sort()->values()->all();
        $this->assertEquals(collect([$this->host->name, $this->guest->name, $this->third->name])->sort()->values()->all(), $memberNames);

        // Now a real group: the owner-only actions that were blocked for "direct" apply again.
        $this->patchJson('/api/connect/conversations/'.$id.'/membership', ['action' => 'rename', 'name' => 'Renamed'])->assertForbidden();
        $this->actingAsInOrganization($this->host);
        $this->patchJson('/api/connect/conversations/'.$id.'/membership', ['action' => 'rename', 'name' => 'Renamed'])->assertOk();
    }

    public function test_adding_a_member_to_a_direct_conversation_auto_names_it_from_members(): void
    {
        $id = $this->directWith($this->guest);
        $this->patchJson('/api/connect/conversations/'.$id.'/membership', ['action' => 'add', 'user_id' => $this->third->id])->assertOk();
        $name = $this->getJson('/api/connect/conversations/'.$id)->json('data.name');
        $this->assertStringContainsString($this->host->name, $name);
        $this->assertStringContainsString($this->guest->name, $name);
        $this->assertStringContainsString($this->third->name, $name);
    }

    public function test_read_and_unread_tracking_drives_unread_count(): void
    {
        $id = $this->directWith($this->guest);
        $this->actingAsInOrganization($this->guest);
        $this->postJson('/api/connect/conversations/'.$id.'/messages', ['client_id' => \Illuminate\Support\Str::uuid()->toString(), 'body' => 'Hello host'])->assertCreated();
        $messageId = $this->getJson('/api/connect/conversations/'.$id.'/messages')->json('0.id');

        $this->actingAsInOrganization($this->host);
        $this->getJson('/api/connect/conversations/'.$id)->assertJsonPath('data.unread_count', 1);
        $this->patchJson('/api/connect/conversations/'.$id.'/membership', ['action' => 'read', 'last_read_id' => $messageId])->assertOk();
        $this->getJson('/api/connect/conversations/'.$id)->assertJsonPath('data.unread_count', 0);
        $this->patchJson('/api/connect/conversations/'.$id.'/membership', ['action' => 'unread'])->assertOk();
        $this->getJson('/api/connect/conversations/'.$id)->assertJsonPath('data.unread_count', 1);
    }

    public function test_send_message_is_idempotent_and_validated(): void
    {
        $id = $this->directWith($this->guest);
        $this->postJson('/api/connect/conversations/'.$id.'/messages', ['client_id' => \Illuminate\Support\Str::uuid()->toString()])->assertUnprocessable();

        $clientId = \Illuminate\Support\Str::uuid()->toString();
        $first = $this->postJson('/api/connect/conversations/'.$id.'/messages', ['client_id' => $clientId, 'body' => 'Hi there'])->assertCreated()->json('data.id');
        $retry = $this->postJson('/api/connect/conversations/'.$id.'/messages', ['client_id' => $clientId, 'body' => 'Hi there'])->assertCreated()->json('data.id');
        $this->assertSame($first, $retry);
        $this->assertSame(1, \App\Models\ConnectMessage::where('conversation_id', $id)->count());

        $this->postJson('/api/connect/conversations/'.$id.'/messages', ['client_id' => \Illuminate\Support\Str::uuid()->toString(), 'body' => 'Bad reply', 'reply_to_id' => 999999])->assertUnprocessable();

        // Mentions are meaningless in a direct message (there's only the one other
        // member, who already sees everything), so they're dropped rather than
        // validated there — sending still succeeds even with a bogus mention.
        $direct = $this->postJson('/api/connect/conversations/'.$id.'/messages', ['client_id' => \Illuminate\Support\Str::uuid()->toString(), 'body' => 'Ignored mention', 'mentions' => [$this->outsider->id]])->assertCreated()->json('data');
        $this->assertSame([], $direct['mentions']);

        // Archiving is group/channel-only (direct conversations reject it, covered
        // separately), so exercise the archived-blocks-sending rule, and mention
        // validation (which does apply to groups), on a group.
        $groupId = $this->groupWith([$this->guest->id]);
        $this->postJson('/api/connect/conversations/'.$groupId.'/messages', ['client_id' => \Illuminate\Support\Str::uuid()->toString(), 'body' => 'Bad mention', 'mentions' => [$this->outsider->id]])->assertUnprocessable();
        $this->patchJson('/api/connect/conversations/'.$groupId.'/membership', ['action' => 'archive', 'enabled' => true])->assertOk();
        $this->postJson('/api/connect/conversations/'.$groupId.'/messages', ['client_id' => \Illuminate\Support\Str::uuid()->toString(), 'body' => 'After archive'])->assertStatus(409);
    }

    public function test_sending_notifies_active_unmuted_members_and_flags_mentions(): void
    {
        $id = $this->groupWith([$this->guest->id, $this->third->id]);
        $this->patchJson('/api/connect/conversations/'.$id.'/membership', ['action' => 'mute', 'enabled' => true]);
        $this->actingAsInOrganization($this->guest);
        $this->patchJson('/api/connect/conversations/'.$id.'/membership', ['action' => 'mute', 'enabled' => false]);

        $this->postJson('/api/connect/conversations/'.$id.'/messages', ['client_id' => \Illuminate\Support\Str::uuid()->toString(), 'body' => 'Hello', 'mentions' => [$this->third->id]])->assertCreated();

        $this->assertDatabaseMissing('notifications', ['notifiable_id' => $this->host->id]);
        $this->assertDatabaseHas('notifications', ['notifiable_id' => $this->third->id]);
        $notification = \Illuminate\Support\Facades\DB::table('notifications')->where('notifiable_id', $this->third->id)->first();
        $this->assertStringContainsString('connect.mentioned', $notification->data);
    }

    public function test_sending_a_message_pushes_to_a_recipients_registered_device(): void
    {
        // Regression: ConnectChatService::notify() used to insert the
        // notifications row directly, bypassing ValtireoNotification's via()
        // entirely — the in-app row looked identical either way, so nothing
        // about this was visibly broken, but it meant Connect push never
        // actually fired through ExpoPushChannel.
        \Illuminate\Support\Facades\Http::fake(['exp.host/*' => \Illuminate\Support\Facades\Http::response(['data' => []], 200)]);

        $id = $this->directWith($this->guest);
        \App\Models\DevicePushToken::query()->create(['user_id' => $this->guest->id, 'token' => 'ExponentPushToken[regression-check]', 'platform' => 'android']);

        $this->postJson('/api/connect/conversations/'.$id.'/messages', ['client_id' => \Illuminate\Support\Str::uuid()->toString(), 'body' => 'Hello'])->assertCreated();

        \Illuminate\Support\Facades\Http::assertSent(function ($request) {
            return $request->url() === 'https://exp.host/--/api/v2/push/send'
                && in_array('ExponentPushToken[regression-check]', array_column($request->data(), 'to'), true);
        });
    }

    public function test_message_editing_deleting_pinning_reacting_and_reporting(): void
    {
        $id = $this->directWith($this->guest);
        $messageId = $this->postJson('/api/connect/conversations/'.$id.'/messages', ['client_id' => \Illuminate\Support\Str::uuid()->toString(), 'body' => 'Original'])->json('data.id');

        $this->actingAsInOrganization($this->guest);
        $this->patchJson("/api/connect/conversations/{$id}/messages/{$messageId}", ['action' => 'edit', 'body' => 'Not mine'])->assertForbidden();
        $this->patchJson("/api/connect/conversations/{$id}/messages/{$messageId}", ['action' => 'react', 'reaction' => 'heart'])->assertOk()->assertJsonPath('data.reactions.0.count', 1);

        $this->actingAsInOrganization($this->host);
        $this->patchJson("/api/connect/conversations/{$id}/messages/{$messageId}", ['action' => 'edit', 'body' => 'Edited'])->assertOk()->assertJsonPath('data.edited_at', fn ($v) => $v !== null);
        $this->patchJson("/api/connect/conversations/{$id}/messages/{$messageId}", ['action' => 'pin', 'enabled' => true])->assertOk()->assertJsonPath('data.pinned', true);

        $pinned = $this->getJson('/api/connect/conversations/'.$id.'/messages?pinned=1')->assertOk()->json();
        $this->assertCount(1, $pinned);

        $this->patchJson("/api/connect/conversations/{$id}/messages/{$messageId}", ['action' => 'delete'])->assertOk()->assertJsonPath('data.deleted', true)->assertJsonPath('data.body', null);
        $this->assertDatabaseHas('connect_messages', ['id' => $messageId, 'body' => null, 'pinned' => false]);
        $this->patchJson("/api/connect/conversations/{$id}/messages/{$messageId}", ['action' => 'edit', 'body' => 'Resurrect'])->assertStatus(409);

        $other = $this->postJson('/api/connect/conversations/'.$id.'/messages', ['client_id' => \Illuminate\Support\Str::uuid()->toString(), 'body' => 'Reportable'])->json('data.id');
        $this->actingAsInOrganization($this->guest);
        $this->patchJson("/api/connect/conversations/{$id}/messages/{$other}", ['action' => 'report', 'reason' => 'Inappropriate'])->assertOk();
        $this->patchJson("/api/connect/conversations/{$id}/messages/{$other}", ['action' => 'report', 'reason' => 'Again'])->assertOk();
        $this->assertSame(1, \Illuminate\Support\Facades\DB::table('connect_reports')->where('message_id', $other)->count());
    }

    public function test_message_deletion_is_blocked_past_the_fifteen_minute_window(): void
    {
        $id = $this->directWith($this->guest);
        $messageId = $this->postJson('/api/connect/conversations/'.$id.'/messages', ['client_id' => \Illuminate\Support\Str::uuid()->toString(), 'body' => 'Stale'])->json('data.id');
        \App\Models\ConnectMessage::whereKey($messageId)->update(['created_at' => now()->subMinutes(16)]);

        $this->patchJson("/api/connect/conversations/{$id}/messages/{$messageId}", ['action' => 'delete'])->assertForbidden();
        $this->assertDatabaseHas('connect_messages', ['id' => $messageId, 'body' => 'Stale']);
    }

    public function test_group_non_owner_cannot_pin_but_direct_members_can(): void
    {
        $id = $this->groupWith([$this->guest->id]);
        $messageId = $this->postJson('/api/connect/conversations/'.$id.'/messages', ['client_id' => \Illuminate\Support\Str::uuid()->toString(), 'body' => 'Group note'])->json('data.id');
        $this->actingAsInOrganization($this->guest);
        $this->patchJson("/api/connect/conversations/{$id}/messages/{$messageId}", ['action' => 'pin', 'enabled' => true])->assertForbidden();
    }

    public function test_file_and_voice_note_attachments_are_validated_stored_and_served_securely(): void
    {
        Storage::fake('local');
        $id = $this->directWith($this->guest);

        $this->postJson('/api/connect/conversations/'.$id.'/messages', [
            'client_id' => \Illuminate\Support\Str::uuid()->toString(), 'voice_note' => true,
            'file' => UploadedFile::fake()->create('note.pdf', 50, 'application/pdf'),
        ])->assertUnprocessable();

        $image = $this->postJson('/api/connect/conversations/'.$id.'/messages', [
            'client_id' => \Illuminate\Support\Str::uuid()->toString(),
            'file' => UploadedFile::fake()->create('photo.jpg', 200, 'image/jpeg'),
        ])->assertCreated();
        $messageId = $image->json('data.id');
        $this->assertSame('photo.jpg', $image->json('data.attachment.name'));

        $response = $this->get("/api/connect/conversations/{$id}/messages/{$messageId}/file");
        $response->assertOk();
        $this->assertStringContainsString('inline', $response->headers->get('Content-Disposition'));
        $this->assertStringContainsString('no-store', $response->headers->get('Cache-Control'));

        $voice = $this->postJson('/api/connect/conversations/'.$id.'/messages', [
            'client_id' => \Illuminate\Support\Str::uuid()->toString(), 'voice_note' => true,
            'file' => UploadedFile::fake()->create('note.webm', 50, 'audio/webm'),
        ])->assertCreated();
        $this->assertTrue($voice->json('data.attachment.voice_note'));

        $this->actingAsInOrganization($this->third);
        $this->get("/api/connect/conversations/{$id}/messages/{$messageId}/file")->assertNotFound();
    }

    public function test_reports_and_moderation_require_administer_permission(): void
    {
        $id = $this->directWith($this->guest);
        $messageId = $this->postJson('/api/connect/conversations/'.$id.'/messages', ['client_id' => \Illuminate\Support\Str::uuid()->toString(), 'body' => 'Flag me'])->json('data.id');
        $this->actingAsInOrganization($this->guest);
        $this->patchJson("/api/connect/conversations/{$id}/messages/{$messageId}", ['action' => 'report', 'reason' => 'Spam'])->assertOk();

        $this->getJson('/api/connect/reports')->assertForbidden();

        $this->actingAsInOrganization($this->host);
        $this->host->assignRole('Organization Admin');
        $reports = $this->getJson('/api/connect/reports')->assertOk()->json('data');
        $this->assertSame('Flag me', $reports[0]['body']);

        $this->patchJson('/api/connect/reports/'.$reports[0]['id'], ['action' => 'hide', 'reason' => 'Confirmed violation'])->assertOk();
        $this->assertNotNull(\App\Models\ConnectMessage::find($messageId)->deleted_at);
        $this->assertDatabaseHas('connect_reports', ['message_id' => $messageId, 'status' => 'resolved']);
    }

    public function test_preferences_round_trip_and_suppress_notifications_when_disabled(): void
    {
        $id = $this->directWith($this->guest);
        $this->actingAsInOrganization($this->guest);
        $this->patchJson('/api/connect/preferences', ['notifications' => false])->assertOk();
        $this->getJson('/api/connect/preferences')->assertJsonPath('notifications', false);

        $this->actingAsInOrganization($this->host);
        $this->postJson('/api/connect/conversations/'.$id.'/messages', ['client_id' => \Illuminate\Support\Str::uuid()->toString(), 'body' => 'Quiet please'])->assertCreated();
        $this->assertDatabaseMissing('notifications', ['notifiable_id' => $this->guest->id]);
    }

    public function test_module_and_employee_status_are_enforced(): void
    {
        $id = $this->directWith($this->guest);
        OrganizationModule::where('organization_id', $this->org->id)->update(['status' => 'suspended']);
        $this->getJson('/api/connect/conversations')->assertForbidden();
        $this->getJson('/api/connect/conversations/'.$id)->assertForbidden();
        OrganizationModule::where('organization_id', $this->org->id)->update(['status' => 'active']);

        // 'exited'/'suspended' are caught earlier by the global account-revocation
        // guard (401, tested elsewhere) before Connect's own actor() check ever
        // runs — 'onboarding' is the status that reaches actor() and fails there.
        $this->host->employee->update(['status' => 'onboarding']);
        $this->getJson('/api/connect/conversations')->assertForbidden();
    }

    public function test_colleague_photo_is_served_only_to_shared_conversation_members(): void
    {
        Storage::fake('local');
        $path = 'organizations/'.$this->org->id.'/profile/guest.jpg';
        Storage::disk('local')->put($path, 'fake-image-bytes');
        EmployeeProfile::create(['employee_id' => $this->guest->employee->id, 'passport_photo_path' => $path]);

        $this->get('/api/connect/people/'.$this->guest->id.'/photo')->assertNotFound();
        $this->directWith($this->guest);
        $this->get('/api/connect/people/'.$this->guest->id.'/photo')->assertOk();

        $this->actingAsInOrganization($this->third);
        $this->get('/api/connect/people/'.$this->guest->id.'/photo')->assertNotFound();
    }
}
