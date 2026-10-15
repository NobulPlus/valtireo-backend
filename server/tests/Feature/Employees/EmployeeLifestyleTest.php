<?php

namespace Tests\Feature\Employees;

use App\Models\Department;
use App\Models\Designation;
use App\Models\Employee;
use App\Models\EmployeeProfile;
use App\Models\EmploymentType;
use App\Models\Organization;
use App\Models\OrganizationLocation;
use App\Models\OrganizationModule;
use App\Models\Permission;
use App\Models\PlatformModule;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class EmployeeLifestyleTest extends TestCase
{
    use RefreshDatabase;

    private Organization $org;

    private Employee $alice;

    private Employee $bob;

    private Employee $carol;

    protected function setUp(): void
    {
        parent::setUp();
        $this->org = Organization::factory()->create(['settings' => ['lifestyle' => ['milestones_enabled' => true, 'appreciation_enabled' => true], 'localization' => ['timezone' => 'Africa/Lagos']]]);
        $module = PlatformModule::factory()->create(['key' => 'employee_self_service', 'is_active' => true]);
        OrganizationModule::create(['organization_id' => $this->org->id, 'platform_module_id' => $module->id, 'status' => 'active']);
        $this->alice = $this->employee('Alice');
        $this->bob = $this->employee('Bob');
        $this->carol = $this->employee('Carol');
    }

    private function employee(string $name): Employee
    {
        $references = [];
        foreach (['department_id' => Department::class, 'designation_id' => Designation::class, 'employment_type_id' => EmploymentType::class, 'organization_location_id' => OrganizationLocation::class] as $key => $class) {
            $references[$key] = $class::firstOrCreate(['organization_id' => $this->org->id, 'code' => 'TEST'], ['name' => 'Test', 'is_active' => true])->id;
        }

        return Employee::factory()->create([...$references, 'unit_id' => null, 'grade_level_id' => null, 'organization_id' => $this->org->id, 'first_name' => $name, 'status' => 'active', 'user_id' => User::factory()->create(['organization_id' => $this->org->id])->id]);
    }

    private function optIn(Employee $employee): void
    {
        $this->actingAsInOrganization($employee->user);
        $this->patchJson('/api/lifestyle/preferences', ['share_birthday' => true, 'share_anniversary' => true, 'receive_appreciation' => true, 'allow_shared_appreciation' => true])->assertOk();
    }

    private function send(string $visibility = 'private'): int
    {
        $this->actingAsInOrganization($this->alice->user);

        return $this->postJson('/api/lifestyle/appreciations', ['recipient_employee_id' => $this->bob->id, 'message' => 'Thank you for helping with the enrolment queue.', 'visibility' => $visibility])->assertCreated()->json('data.id');
    }

    public function test_preferences_are_private_and_opt_in_is_required(): void
    {
        $this->actingAsInOrganization($this->alice->user);
        $this->getJson('/api/lifestyle/preferences')->assertOk()->assertJsonPath('preferences.share_birthday', false)->assertJsonPath('preferences.receive_appreciation', false);
        $this->getJson('/api/lifestyle/appreciation-recipients')->assertOk()->assertJsonCount(0, 'data');
        $this->postJson('/api/lifestyle/appreciations', ['recipient_employee_id' => $this->bob->id, 'message' => 'Thanks'])->assertUnprocessable();
        $this->patchJson('/api/lifestyle/preferences', ['employee_id' => $this->bob->id, 'share_birthday' => true])->assertOk();
        $this->actingAsInOrganization($this->bob->user);
        $this->getJson('/api/lifestyle/preferences')->assertJsonPath('preferences.share_birthday', false);
    }

    public function test_appreciation_alerts_require_opt_in_and_do_not_disclose_private_content(): void
    {
        $this->optIn($this->bob);
        $this->send();
        $this->assertDatabaseCount('notifications', 0);
        $this->actingAsInOrganization($this->bob->user);
        $this->patchJson('/api/lifestyle/preferences', ['appreciation_notifications' => true])->assertOk();
        $this->send();
        $this->assertDatabaseCount('notifications', 1);
        $alert = \Illuminate\Support\Facades\DB::table('notifications')->first();
        $this->assertSame($this->bob->user_id, (int) $alert->notifiable_id);
        $this->assertStringNotContainsString('enrolment queue', $alert->data);
        $this->actingAsInOrganization($this->bob->user);
        $this->patchJson('/api/lifestyle/preferences', ['appreciation_notifications' => false])->assertOk();
        $this->send();
        $this->assertDatabaseCount('notifications', 1);
    }

    public function test_milestones_use_local_date_and_never_expose_birth_year_or_age(): void
    {
        $this->travelTo(now()->setTimezone('UTC')->setDate(2026, 12, 31)->setTime(23, 30));
        $this->bob->update(['start_date' => '2024-01-01']);
        EmployeeProfile::create(['employee_id' => $this->bob->id, 'date_of_birth' => '1985-01-01']);
        $this->optIn($this->bob);
        $this->actingAsInOrganization($this->alice->user);
        $response = $this->getJson('/api/lifestyle/milestones?days=1')->assertOk()->assertJsonCount(2, 'data');
        $this->assertStringNotContainsString('1985', $response->getContent());
        $this->assertStringNotContainsString('date_of_birth', $response->getContent());
        $this->assertSame('2027-01-01', $response->json('data.0.date'));
        $anniversary = collect($response->json('data'))->firstWhere('type', 'anniversary');
        $this->assertSame(3, $anniversary['years_of_service']);
        $this->bob->update(['status' => 'suspended']);
        $this->getJson('/api/lifestyle/milestones?days=1')->assertJsonCount(0, 'data');
    }

    public function test_leap_birthdays_and_year_boundary_are_predictable(): void
    {
        $this->travelTo(now()->setDate(2027, 2, 28)->setTime(12, 0));
        EmployeeProfile::create(['employee_id' => $this->bob->id, 'date_of_birth' => '2000-02-29']);
        $this->optIn($this->bob);
        $this->actingAsInOrganization($this->alice->user);
        $this->getJson('/api/lifestyle/milestones?days=1')->assertJsonPath('data.0.date', '2027-02-28');
        $this->getJson('/api/lifestyle/milestones?days=1000')->assertUnprocessable();
        $this->travelTo(now()->setDate(2027, 12, 31)->setTime(12, 0));
        $this->bob->profile->update(['date_of_birth' => '2000-01-01']);
        $this->getJson('/api/lifestyle/milestones?days=2')->assertJsonPath('data.0.date', '2028-01-01');
    }

    public function test_private_appreciation_is_only_visible_to_participants_and_publication_consent_can_be_withdrawn(): void
    {
        $this->optIn($this->bob);
        $private = $this->send();
        $this->actingAsInOrganization($this->carol->user);
        $this->getJson('/api/lifestyle/appreciations')->assertJsonCount(0, 'data');
        $this->deleteJson('/api/lifestyle/appreciations/'.$private)->assertNotFound();
        $this->postJson('/api/lifestyle/appreciations/'.$private.'/report', ['reason' => 'Cannot see this'])->assertNotFound();
        $this->actingAsInOrganization($this->bob->user);
        $this->getJson('/api/lifestyle/appreciations?scope=received')->assertJsonCount(1, 'data');
        $shared = $this->send('shared');
        $this->actingAsInOrganization($this->carol->user);
        $this->getJson('/api/lifestyle/appreciations')->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $shared);
        $this->actingAsInOrganization($this->bob->user);
        $this->patchJson('/api/lifestyle/preferences', ['allow_shared_appreciation' => false])->assertOk();
        $this->patchJson('/api/lifestyle/preferences', ['allow_shared_appreciation' => true])->assertOk();
        $this->actingAsInOrganization($this->carol->user);
        $this->getJson('/api/lifestyle/appreciations')->assertJsonCount(0, 'data');
        $this->actingAsInOrganization($this->bob->user);
        $this->deleteJson('/api/lifestyle/appreciations/'.$private)->assertNoContent();
        $this->getJson('/api/lifestyle/appreciations')->assertJsonCount(1, 'data');
    }

    public function test_cross_organization_and_self_sends_are_rejected_and_lists_are_isolated(): void
    {
        $this->optIn($this->bob);
        $id = $this->send('shared');
        $this->org = Organization::factory()->create();
        $outsider = $this->employee('Outsider');
        $this->actingAsInOrganization($this->alice->user);
        foreach ([$outsider->id, $this->alice->id] as $recipient) {
            $this->postJson('/api/lifestyle/appreciations', ['recipient_employee_id' => $recipient, 'message' => 'Thanks'])->assertUnprocessable();
        }
        // Give the outsider the same module, but never access to another tenant's records.
        $this->org->update(['settings' => ['lifestyle' => ['appreciation_enabled' => true, 'milestones_enabled' => true]]]);
        OrganizationModule::create(['organization_id' => $this->org->id, 'platform_module_id' => PlatformModule::where('key', 'employee_self_service')->value('id'), 'status' => 'active']);
        $this->actingAsInOrganization($outsider->user);
        $this->getJson('/api/lifestyle/appreciations')->assertJsonCount(0, 'data');
        $this->getJson('/api/lifestyle/milestones')->assertJsonCount(0, 'data');
        $this->deleteJson('/api/lifestyle/appreciations/'.$id)->assertNotFound();
        $this->postJson('/api/lifestyle/appreciations/'.$id.'/report', ['reason' => 'Outside tenant'])->assertNotFound();
    }

    public function test_only_reported_messages_are_exposed_to_moderators(): void
    {
        $this->optIn($this->bob);
        $reported = $this->send();
        $unreported = $this->send();
        $this->actingAsInOrganization($this->bob->user);
        $this->postJson('/api/lifestyle/appreciations/'.$reported.'/report', ['reason' => 'Unwanted message'])->assertOk();
        $this->postJson('/api/lifestyle/appreciations/'.$reported.'/report', ['reason' => 'Updated reason'])->assertOk();
        $this->assertDatabaseCount('employee_appreciation_reports', 1);
        $this->getJson('/api/lifestyle/reports')->assertForbidden();
        $permission = Permission::firstOrCreate(['name' => 'workspace_settings.update', 'guard_name' => 'web']);
        $this->setPermissionsTeamId($this->carol->organization_id);
        $this->carol->user->givePermissionTo($permission);
        $this->actingAsInOrganization($this->carol->user);
        $this->getJson('/api/lifestyle/reports')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $reported);
        $this->patchJson('/api/lifestyle/appreciations/'.$unreported.'/hide', ['reason' => 'Not reported'])->assertNotFound();
        $this->patchJson('/api/lifestyle/appreciations/'.$reported.'/hide', ['reason' => 'Violates workplace policy'])->assertNoContent();
        $this->getJson('/api/lifestyle/reports')->assertJsonCount(0, 'data');
        $this->actingAsInOrganization($this->bob->user);
        $this->getJson('/api/lifestyle/appreciations')->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $unreported);
    }

    public function test_organization_controls_and_subscription_gate_apply(): void
    {
        $this->actingAsInOrganization($this->alice->user);
        $this->patchJson('/api/workspace/settings', ['lifestyle' => ['milestones_enabled' => false]])->assertForbidden();
        $permission = Permission::firstOrCreate(['name' => 'workspace_settings.update', 'guard_name' => 'web']);
        $this->alice->user->givePermissionTo($permission);
        $this->actingAsInOrganization($this->alice->user->fresh());
        $this->patchJson('/api/workspace/settings', ['lifestyle' => ['milestones_enabled' => false, 'appreciation_enabled' => false]])->assertOk();
        $this->actingAsInOrganization($this->alice->user->fresh());
        $this->getJson('/api/lifestyle/milestones')->assertForbidden();
        $this->getJson('/api/lifestyle/appreciations')->assertForbidden();
        $this->patchJson('/api/lifestyle/preferences', ['share_birthday' => false])->assertOk();
        OrganizationModule::where('organization_id', $this->org->id)->update(['status' => 'suspended']);
        $this->getJson('/api/lifestyle/preferences')->assertForbidden();
    }

    public function test_input_limits_pagination_and_inactive_recipient(): void
    {
        $this->optIn($this->bob);
        $this->send();
        $this->send();
        $this->getJson('/api/lifestyle/appreciations?scope=sent&per_page=1')->assertJsonCount(1, 'data')->assertJsonPath('total', 2)->assertJsonPath('last_page', 2);
        $this->postJson('/api/lifestyle/appreciations', ['recipient_employee_id' => $this->bob->id, 'message' => '   '])->assertUnprocessable();
        $this->postJson('/api/lifestyle/appreciations', ['recipient_employee_id' => $this->bob->id, 'message' => str_repeat('x', 1001)])->assertUnprocessable();
        $this->bob->update(['status' => 'exited']);
        $this->postJson('/api/lifestyle/appreciations', ['recipient_employee_id' => $this->bob->id, 'message' => 'Thanks'])->assertUnprocessable();
        $this->getJson('/api/lifestyle/appreciations')->assertJsonCount(0, 'data');
    }

    public function test_sending_is_rate_limited_and_does_not_consume_report_limit(): void
    {
        $this->optIn($this->bob);
        for ($i = 0; $i < 10; $i++) {
            $id = $this->send();
        }
        $this->postJson('/api/lifestyle/appreciations', ['recipient_employee_id' => $this->bob->id, 'message' => 'Too many'])->assertStatus(429);
        $this->postJson('/api/lifestyle/appreciations/'.$id.'/report', ['reason' => 'Separate limit'])->assertOk();
        $this->assertDatabaseCount('employee_appreciations', 10);
    }
}
