<?php

namespace Tests\Feature\Security;

use App\Models\Department;
use App\Models\Designation;
use App\Models\Employee;
use App\Models\EmployeeCustomField;
use App\Models\EmployeeInvitation;
use App\Models\EmploymentType;
use App\Models\Organization;
use App\Models\OrganizationLocation;
use App\Models\User;
use App\Services\EmployeeInvitationService;
use App\Support\AuditRedactor;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\PlatformModuleSeeder;
use App\Models\PlatformModule;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class AccessPrivacyRegressionTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Notification::fake();
        $this->seed(RolePermissionSeeder::class);
        $this->seed(PlatformModuleSeeder::class);
    }

    private function employee(string $status = 'active', ?Organization $organization = null, array $attributes = []): Employee
    {
        $organization ??= Organization::factory()->create(['status' => 'active']);
        foreach (PlatformModule::all() as $module) {
            $organization->moduleSubscriptions()->firstOrCreate(['platform_module_id' => $module->id], ['status' => 'active']);
        }
        $scope = ['organization_id' => $organization->id];
        $user = User::factory()->create([...$scope, 'password' => 'Password1!']);

        return Employee::factory()->create([
            ...$scope,
            'user_id' => $user->id,
            'department_id' => Department::factory()->create($scope)->id,
            'designation_id' => Designation::factory()->create($scope)->id,
            'employment_type_id' => EmploymentType::factory()->create($scope)->id,
            'organization_location_id' => OrganizationLocation::factory()->create($scope)->id,
            'unit_id' => null,
            'grade_level_id' => null,
            'status' => $status,
            ...$attributes,
        ]);
    }

    public function test_suspended_and_exited_employees_cannot_sign_in(): void
    {
        foreach (['suspended', 'exited'] as $status) {
            $employee = $this->employee($status);
            $this->postJson('/api/auth/login', [
                'email' => $employee->user->email, 'password' => 'Password1!',
            ])->assertUnprocessable()->assertJsonValidationErrors('email');
            $this->assertSame(0, $employee->user->tokens()->count());
        }
    }

    public function test_active_and_onboarding_accounts_can_still_sign_in(): void
    {
        foreach (['active', 'onboarding'] as $status) {
            $employee = $this->employee($status);
            $this->postJson('/api/auth/login', [
                'email' => $employee->user->email, 'password' => 'Password1!',
            ])->assertOk()->assertJsonStructure(['token']);
        }
    }

    public function test_status_changes_revoke_every_token_and_reactivation_does_not_restore_them(): void
    {
        $employee = $this->employee();
        $employee->user->createToken('web');
        $employee->user->createToken('mobile');
        $employee->update(['status' => 'suspended']);
        $this->assertSame(0, $employee->user->tokens()->count());
        $employee->update(['status' => 'active']);
        $this->assertSame(0, $employee->user->tokens()->count());
    }

    public function test_existing_token_is_denied_even_when_status_was_changed_without_model_events(): void
    {
        $employee = $this->employee();
        $token = $employee->user->createToken('existing')->plainTextToken;
        Employee::query()->whereKey($employee->id)->update(['status' => 'exited']);

        $this->withToken($token)->getJson('/api/auth/me')
            ->assertUnauthorized()->assertJsonPath('code', 'account_access_revoked');
        $this->assertSame(0, $employee->user->tokens()->count());
    }

    public function test_blocked_account_cannot_mint_a_token_through_another_caller(): void
    {
        $employee = $this->employee('suspended');
        $this->expectException(ValidationException::class);
        $employee->user->createToken('another-caller');
    }

    public function test_old_invitation_cannot_reset_a_blocked_or_active_account(): void
    {
        foreach (['suspended', 'exited', 'active'] as $status) {
            $employee = $this->employee($status);
            $invitation = EmployeeInvitation::query()->create([
                'organization_id' => $employee->organization_id,
                'employee_id' => $employee->id,
                'email' => $employee->user->email,
                'token_hash' => hash('sha256', 'old-'.$employee->id),
                'status' => 'pending', 'expires_at' => now()->addDay(),
            ]);
            try {
                app(EmployeeInvitationService::class)->accept('old-'.$employee->id, 'NewPassword1!');
                $this->fail('Old invitation unexpectedly accepted.');
            } catch (ValidationException $exception) {
                $this->assertArrayHasKey('token', $exception->errors());
            }
            $this->assertSame($status, $employee->fresh()->status);
            $this->assertSame('pending', $invitation->fresh()->status);
            $this->assertTrue(Hash::check('Password1!', $employee->user->fresh()->password));
            $this->assertSame(0, $employee->user->tokens()->count());
        }
    }

    public function test_login_is_throttled_and_recovers_after_the_window(): void
    {
        $body = ['email' => 'rate-limit@example.test', 'password' => 'wrong'];
        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/auth/login', $body)->assertUnprocessable();
        }
        $this->postJson('/api/auth/login', $body)->assertStatus(429)->assertHeader('Retry-After');
        $this->travel(61)->seconds();
        $this->postJson('/api/auth/login', $body)->assertUnprocessable();
    }

    public function test_self_overview_omits_hidden_and_inactive_fields_at_both_locations(): void
    {
        $employee = $this->employee();
        foreach ([['visible', true, true], ['hidden', false, true], ['inactive', true, false]] as [$key, $visible, $active]) {
            $field = EmployeeCustomField::query()->create([
                'organization_id' => $employee->organization_id, 'name' => $key,
                'key' => $key, 'type' => 'text', 'visible_to_employee' => $visible, 'is_active' => $active,
            ]);
            $employee->customFieldValues()->create([
                'organization_id' => $employee->organization_id,
                'employee_custom_field_id' => $field->id, 'value' => $key.'-value',
            ]);
        }
        $this->actingAsInOrganization($employee->user);
        $response = $this->getJson('/api/employee-profile/overview')->assertOk();
        $response->assertJsonCount(1, 'custom_fields')
            ->assertJsonCount(1, 'employee.custom_fields')
            ->assertJsonFragment(['value' => 'visible-value'])
            ->assertJsonMissing(['value' => 'hidden-value'])
            ->assertJsonMissing(['value' => 'inactive-value']);
    }

    public function test_password_changes_do_not_produce_credential_audit_values(): void
    {
        config(['audit.console' => true]);
        $user = User::factory()->create(['password' => 'Password1!']);
        $user->update(['name' => 'Changed Name', 'password' => 'NewPassword1!', 'remember_token' => 'private']);
        $audits = $user->audits()->get();
        $this->assertNotEmpty($audits);
        foreach ($audits as $audit) {
            foreach ([$audit->old_values, $audit->new_values] as $values) {
                $this->assertArrayNotHasKey('password', $values);
                $this->assertArrayNotHasKey('remember_token', $values);
            }
        }
    }

    public function test_historical_audit_values_are_recursively_redacted(): void
    {
        $safe = AuditRedactor::values([
            'name' => 'Unchanged', 'password' => 'hash',
            'nested' => ['access_token' => 'secret', 'bank_account_number' => '1234567890'],
        ]);
        $this->assertSame('Unchanged', $safe['name']);
        $this->assertSame('[REDACTED]', $safe['password']);
        $this->assertSame('[REDACTED]', $safe['nested']['access_token']);
        $this->assertSame('[REDACTED]', $safe['nested']['bank_account_number']);
    }

    public function test_supervisor_lists_details_and_exports_stay_inside_the_team(): void
    {
        $manager = $this->employee();
        $report = $this->employee('active', $manager->organization, ['reporting_manager_id' => $manager->id]);
        $outside = $this->employee('active', $manager->organization, ['employee_number' => 'OUTSIDE-SCOPE']);
        $foreign = $this->employee();
        $this->setPermissionsTeamId($manager->organization_id);
        $manager->user->givePermissionTo(['employees.view', 'employees.view_team', 'reports.view']);
        $this->actingAsInOrganization($manager->user);

        $this->getJson('/api/employees')->assertOk()->assertJsonCount(2, 'data')
            ->assertJsonFragment(['employee_number' => $report->employee_number])
            ->assertJsonMissing(['employee_number' => 'OUTSIDE-SCOPE']);
        $this->getJson('/api/employees/'.$outside->id)->assertNotFound();
        $this->getJson('/api/employees/'.$foreign->id)->assertNotFound();
        $this->getJson('/api/employees/'.$outside->id.'/profile-overview')->assertNotFound();
        $this->getJson('/api/employee-profile/dependents?employee_id='.$outside->id)->assertNotFound();
        $this->getJson('/api/employees/'.$report->id)->assertOk();
        $csv = $this->get('/api/employees/export')->assertOk()->streamedContent();
        $this->assertStringContainsString($report->employee_number, $csv);
        $this->assertStringNotContainsString('OUTSIDE-SCOPE', $csv);
        $this->getJson('/api/reports/employee_directory')->assertOk()->assertJsonCount(2, 'data');
        $reportCsv = $this->get('/api/reports/employee_directory/export')->assertOk()->streamedContent();
        $this->assertStringContainsString($report->employee_number, $reportCsv);
        $this->assertStringNotContainsString('OUTSIDE-SCOPE', $reportCsv);
        $this->getJson('/api/dashboard/organization')->assertForbidden();
    }

    public function test_department_visibility_requires_a_real_department_head_assignment(): void
    {
        $head = $this->employee();
        $member = $this->employee('active', $head->organization, ['department_id' => $head->department_id]);
        $outside = $this->employee('active', $head->organization);
        $this->setPermissionsTeamId($head->organization_id);
        $head->user->givePermissionTo(['employees.view', 'employees.view_department']);
        $scope = app(\App\Services\EmployeeVisibility::class);
        $this->assertFalse($scope->allows($head->user, $member->id));
        $head->department->update(['head_employee_id' => $head->id]);
        $this->assertTrue($scope->allows($head->user, $member->id));
        $this->assertFalse($scope->allows($head->user, $outside->id));
    }

    public function test_organization_scope_preserves_same_tenant_access_only(): void
    {
        $admin = $this->employee();
        $colleague = $this->employee('active', $admin->organization);
        $foreign = $this->employee();
        $this->setPermissionsTeamId($admin->organization_id);
        $admin->user->givePermissionTo(['employees.view', 'employees.view_all']);
        $this->actingAsInOrganization($admin->user);
        $this->getJson('/api/employees/'.$colleague->id)->assertOk();
        $this->getJson('/api/employees/'.$foreign->id)->assertNotFound();
    }

    public function test_missing_employee_assignment_does_not_expand_team_scope(): void
    {
        $employee = $this->employee();
        $user = User::factory()->create(['organization_id' => $employee->organization_id]);
        $this->setPermissionsTeamId($employee->organization_id);
        $user->givePermissionTo(['employees.view', 'employees.view_team']);
        $this->actingAsInOrganization($user);
        $this->getJson('/api/employees')->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_attendance_lists_and_direct_ids_use_the_same_team_scope(): void
    {
        $manager = $this->employee();
        $report = $this->employee('active', $manager->organization, ['reporting_manager_id' => $manager->id]);
        $outside = $this->employee('active', $manager->organization);
        $records = [];
        foreach ([$report, $outside] as $employee) {
            $records[] = \App\Models\AttendanceRecord::query()->create([
                'organization_id' => $employee->organization_id, 'employee_id' => $employee->id,
                'attendance_date' => today(), 'status' => 'present', 'source' => 'manual',
            ]);
        }
        $this->setPermissionsTeamId($manager->organization_id);
        $manager->user->givePermissionTo(['employees.view_team', 'attendance.view']);
        $this->actingAsInOrganization($manager->user);
        $this->getJson('/api/attendance/records')->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $records[0]->id);
        $this->getJson('/api/attendance/records/'.$records[1]->id)->assertNotFound();
        $this->getJson('/api/attendance/records?employee_id='.$outside->id)->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_approval_view_permission_alone_does_not_reveal_other_teams_or_payroll(): void
    {
        $manager = $this->employee();
        $report = $this->employee('active', $manager->organization, ['reporting_manager_id' => $manager->id]);
        $outside = $this->employee('active', $manager->organization);
        $approvals = [];
        foreach ([[$report, 'leave'], [$outside, 'leave'], [$outside, 'payroll']] as [$subject, $module]) {
            $approvals[] = \App\Models\ApprovalRequest::query()->create([
                'organization_id' => $manager->organization_id, 'subject_employee_id' => $subject->id,
                'approvable_type' => Department::class, 'approvable_id' => $subject->department_id,
                'module' => $module, 'action' => 'submit', 'title' => 'Private approval', 'status' => 'pending',
                'metadata' => ['private_marker' => $module.'-'.$subject->id],
            ]);
        }
        $this->setPermissionsTeamId($manager->organization_id);
        $manager->user->givePermissionTo(['employees.view_team', 'approvals.view', 'leave_requests.view']);
        $this->actingAsInOrganization($manager->user);
        $this->getJson('/api/approvals')->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $approvals[0]->id);
        $this->getJson('/api/approvals/'.$approvals[1]->id)->assertNotFound();
        $this->getJson('/api/approvals/'.$approvals[2]->id)->assertNotFound();
    }

    public function test_error_reporting_does_not_store_nested_inputs_query_values_or_exception_messages(): void
    {
        config(['app.debug' => false]);
        \Illuminate\Support\Facades\Log::spy();
        \Illuminate\Support\Facades\Route::post('/api/privacy-probe/{token}', function (): void {
            throw new \RuntimeException('PRIVATE-EXCEPTION-MESSAGE');
        });
        $this->withHeaders(['User-Agent' => 'PRIVATE-USER-AGENT', 'X-Request-Id' => 'PRIVATE-REQUEST-ID'])
            ->postJson('/api/privacy-probe/PRIVATE-PATH?query=PRIVATE-QUERY', [
                'employee' => ['password' => 'PRIVATE-PASSWORD', 'bank_account_number' => 'PRIVATE-BANK'],
                'note' => 'PRIVATE-NOTE',
            ])->assertStatus(500);
        $log = \App\Models\SystemErrorLog::query()->latest('id')->firstOrFail();
        $this->assertStringNotContainsString('PRIVATE-', $log->toJson());
        $this->assertSame(\RuntimeException::class, $log->exception_class);
        $this->assertSame(2, $log->context['privacy_version']);
        \Illuminate\Support\Facades\Log::shouldHaveReceived('error')->once()
            ->withArgs(fn ($message, $context) => $message === 'Unhandled application exception'
                && ! str_contains(json_encode($context), 'PRIVATE-'));
    }

    public function test_error_resource_hides_sensitive_historical_details(): void
    {
        $log = new \App\Models\SystemErrorLog([
            'exception_class' => \RuntimeException::class, 'message' => 'PRIVATE-MESSAGE',
            'url' => '/invite/PRIVATE-TOKEN', 'route' => '/invite/PRIVATE-TOKEN',
            'context' => ['input' => ['nested' => ['password' => 'PRIVATE-PASSWORD']]],
            'user_agent' => 'PRIVATE-UA', 'request_id' => 'PRIVATE-REQUEST',
        ]);
        $payload = (new \App\Http\Resources\SystemErrorLogResource($log))->resolve();
        $this->assertStringNotContainsString('PRIVATE-', json_encode($payload));
    }
}
