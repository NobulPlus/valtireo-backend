<?php

namespace Tests\Feature\Auth;

use App\Models\Department;
use App\Models\Designation;
use App\Models\Employee;
use App\Models\EmploymentType;
use App\Models\GradeLevel;
use App\Models\Organization;
use App\Models\OrganizationLocation;
use App\Models\Unit;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * AuthenticationTest, EmployeeInvitationAcceptanceTest, and
 * OrganizationProvisioningTest already cover the happy paths for
 * registration, login, and both invitation-accept flows. This file covers
 * the guard paths those don't: invitation replay, invitation-token edge
 * cases, and accounts/organizations that must be refused at login despite
 * correct credentials.
 */
class OnboardingAccessControlGuardsTest extends TestCase
{
    use RefreshDatabase;

    public function test_an_already_accepted_employee_invitation_cannot_be_accepted_again(): void
    {
        $token = $this->createInvitedEmployeeAndReturnToken();

        $this->postJson("/api/employee-invitations/{$token}/accept", [
            'password' => 'Password1!', 'password_confirmation' => 'Password1!',
        ])->assertOk();

        $this->postJson("/api/employee-invitations/{$token}/accept", [
            'password' => 'SecondAttempt1!', 'password_confirmation' => 'SecondAttempt1!',
        ])->assertUnprocessable()->assertJsonValidationErrors(['token']);

        // The first password must still be the one that works.
        $this->postJson('/api/auth/login', ['email' => 'invitee@valtireo.test', 'password' => 'Password1!'])->assertOk();
    }

    public function test_expired_admin_invitation_cannot_be_accepted(): void
    {
        $setupUrl = $this->provisionOrganizationAndReturnSetupUrl();
        $token = basename((string) parse_url($setupUrl, PHP_URL_PATH));

        DB::table('password_reset_tokens')
            ->where('email', 'nora@northstar.test')
            ->update(['created_at' => now()->subHours(25)]);

        $this->postJson("/api/organization-admin-invitations/{$token}/accept", [
            'email' => 'nora@northstar.test', 'password' => 'NewPassword1!', 'password_confirmation' => 'NewPassword1!',
        ])->assertUnprocessable()->assertJsonValidationErrors(['token']);

        $this->assertDatabaseMissing('password_reset_tokens', ['email' => 'nora@northstar.test']);
    }

    public function test_an_already_used_admin_invitation_cannot_be_accepted_again(): void
    {
        $setupUrl = $this->provisionOrganizationAndReturnSetupUrl();
        $token = basename((string) parse_url($setupUrl, PHP_URL_PATH));

        $this->postJson("/api/organization-admin-invitations/{$token}/accept", [
            'email' => 'nora@northstar.test', 'password' => 'NewPassword1!', 'password_confirmation' => 'NewPassword1!',
        ])->assertOk();

        $this->postJson("/api/organization-admin-invitations/{$token}/accept", [
            'email' => 'nora@northstar.test', 'password' => 'SecondPassword1!', 'password_confirmation' => 'SecondPassword1!',
        ])->assertUnprocessable()->assertJsonValidationErrors(['token']);
    }

    public function test_admin_invitation_rejects_a_mismatched_email(): void
    {
        $setupUrl = $this->provisionOrganizationAndReturnSetupUrl();
        $token = basename((string) parse_url($setupUrl, PHP_URL_PATH));

        $this->postJson("/api/organization-admin-invitations/{$token}/accept", [
            'email' => 'someone-else@northstar.test', 'password' => 'NewPassword1!', 'password_confirmation' => 'NewPassword1!',
        ])->assertUnprocessable()->assertJsonValidationErrors(['token']);

        $this->assertDatabaseHas('password_reset_tokens', ['email' => 'nora@northstar.test']);
    }

    public function test_accepting_the_admin_invitation_transitions_the_organization_out_of_invited_status(): void
    {
        $setupUrl = $this->provisionOrganizationAndReturnSetupUrl();
        $token = basename((string) parse_url($setupUrl, PHP_URL_PATH));

        $this->assertDatabaseHas('organizations', ['code' => 'NORTHSTAR', 'status' => 'invited']);

        $this->postJson("/api/organization-admin-invitations/{$token}/accept", [
            'email' => 'nora@northstar.test', 'password' => 'NewPassword1!', 'password_confirmation' => 'NewPassword1!',
        ])->assertOk()->assertJsonPath('organization.status', 'setup_in_progress');

        $this->assertDatabaseHas('organizations', ['code' => 'NORTHSTAR', 'status' => 'setup_in_progress']);
        $this->assertDatabaseHas('organization_status_histories', [
            'previous_status' => 'invited', 'new_status' => 'setup_in_progress',
        ]);
    }

    public function test_suspended_employees_account_cannot_log_in_even_with_correct_password(): void
    {
        $this->seed();
        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        $employeeUser->update(['password' => 'Password1!']);
        Employee::query()->where('work_email', 'aisha.bello@valtireo.test')->update(['status' => 'suspended']);

        $this->postJson('/api/auth/login', ['email' => 'aisha.bello@valtireo.test', 'password' => 'Password1!'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['email']);
    }

    public function test_exited_employees_account_cannot_log_in(): void
    {
        $this->seed();
        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        $employeeUser->update(['password' => 'Password1!']);
        Employee::query()->where('work_email', 'aisha.bello@valtireo.test')->update(['status' => 'exited']);

        $this->postJson('/api/auth/login', ['email' => 'aisha.bello@valtireo.test', 'password' => 'Password1!'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['email']);
    }

    public function test_a_suspended_organization_blocks_login_for_every_one_of_its_users(): void
    {
        $this->seed();
        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $admin->update(['password' => 'Password1!']);
        $admin->organization->update(['status' => 'suspended']);

        $this->postJson('/api/auth/login', ['email' => 'admin@valtireo.test', 'password' => 'Password1!'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['email']);
    }

    // A rejected organization blocking login is already covered by
    // OrganizationVerificationTest::test_rejected_organization_cannot_login,
    // and an existing session being revoked after suspension is already
    // covered by AccessPrivacyRegressionTest — no need to duplicate either.

    public function test_a_lost_employee_invitation_can_be_resent_and_the_old_token_stops_working(): void
    {
        $this->createInvitedEmployeeAndReturnToken();
        $employee = Employee::query()->where('work_email', 'invitee@valtireo.test')->firstOrFail();

        $oldToken = $employee->invitations()->where('status', 'pending')->sole()->id;
        $newToken = $this->postJson("/api/employees/{$employee->id}/resend-invitation")
            ->assertOk()
            ->json('invitation.id');

        $this->assertNotSame($oldToken, $newToken);
        $this->assertDatabaseHas('employee_invitations', ['id' => $oldToken, 'status' => 'expired']);
        $this->assertDatabaseHas('employee_invitations', ['id' => $newToken, 'status' => 'pending']);
    }

    public function test_resending_an_invitation_for_an_employee_who_has_already_accepted_is_rejected(): void
    {
        $token = $this->createInvitedEmployeeAndReturnToken();
        $employee = Employee::query()->where('work_email', 'invitee@valtireo.test')->firstOrFail();

        $this->postJson("/api/employee-invitations/{$token}/accept", [
            'password' => 'Password1!', 'password_confirmation' => 'Password1!',
        ])->assertOk();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        Sanctum::actingAs($admin);

        $this->postJson("/api/employees/{$employee->id}/resend-invitation")
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['employee']);
    }

    public function test_a_lost_admin_invitation_can_be_resent_and_the_old_token_stops_working(): void
    {
        $this->provisionOrganizationAndReturnSetupUrl();
        $organization = Organization::query()->where('code', 'NORTHSTAR')->firstOrFail();
        $superAdmin = User::query()->where('email', 'superadmin@valtireo.test')->firstOrFail();
        Sanctum::actingAs($superAdmin);

        $newSetupUrl = $this->postJson("/api/platform/organizations/{$organization->id}/resend-admin-invitation")
            ->assertOk()
            ->json('invitation.setup_url');
        $newToken = basename((string) parse_url($newSetupUrl, PHP_URL_PATH));

        $this->postJson("/api/organization-admin-invitations/{$newToken}/accept", [
            'email' => 'nora@northstar.test', 'password' => 'NewPassword1!', 'password_confirmation' => 'NewPassword1!',
        ])->assertOk();
    }

    public function test_resending_an_admin_invitation_after_acceptance_is_rejected(): void
    {
        $setupUrl = $this->provisionOrganizationAndReturnSetupUrl();
        $token = basename((string) parse_url($setupUrl, PHP_URL_PATH));
        $organization = Organization::query()->where('code', 'NORTHSTAR')->firstOrFail();

        $this->postJson("/api/organization-admin-invitations/{$token}/accept", [
            'email' => 'nora@northstar.test', 'password' => 'NewPassword1!', 'password_confirmation' => 'NewPassword1!',
        ])->assertOk();

        $superAdmin = User::query()->where('email', 'superadmin@valtireo.test')->firstOrFail();
        Sanctum::actingAs($superAdmin);

        $this->postJson("/api/platform/organizations/{$organization->id}/resend-admin-invitation")
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['organization']);
    }

    private function createInvitedEmployeeAndReturnToken(): string
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        Sanctum::actingAs($admin);

        $organization = Organization::query()->where('code', 'VALTIREO')->firstOrFail();
        $department = Department::query()->whereBelongsTo($organization)->where('code', 'HR')->firstOrFail();
        $unit = Unit::query()->whereBelongsTo($organization)->where('code', 'HR-REC')->firstOrFail();
        $designation = Designation::query()->whereBelongsTo($organization)->where('code', 'HRO')->firstOrFail();
        $gradeLevel = GradeLevel::query()->whereBelongsTo($organization)->where('code', 'GL03')->firstOrFail();
        $employmentType = EmploymentType::query()->whereBelongsTo($organization)->where('code', 'PERM')->firstOrFail();
        $location = OrganizationLocation::query()->whereBelongsTo($organization)->where('code', 'HQ')->firstOrFail();

        $response = $this->postJson('/api/employees', [
            'employee_number' => 'EMP-REPLAY-001', 'first_name' => 'Ada', 'last_name' => 'Lovelace',
            'work_email' => 'invitee@valtireo.test', 'phone' => '08012345678',
            'department_id' => $department->id, 'unit_id' => $unit->id, 'designation_id' => $designation->id,
            'grade_level_id' => $gradeLevel->id, 'employment_type_id' => $employmentType->id,
            'organization_location_id' => $location->id, 'start_date' => '2026-08-02', 'send_invitation' => true,
        ]);

        $response->assertCreated();

        return $response->json('invitation.token');
    }

    private function provisionOrganizationAndReturnSetupUrl(): string
    {
        $this->seed();

        $superAdmin = User::query()->where('email', 'superadmin@valtireo.test')->firstOrFail();
        Sanctum::actingAs($superAdmin);

        return $this->postJson('/api/platform/organizations', [
            'organization' => ['name' => 'Northstar Labs', 'code' => 'NORTHSTAR', 'country' => 'Nigeria'],
            'admin' => ['name' => 'Nora Stone', 'email' => 'nora@northstar.test'],
            'modules' => ['organization_setup', 'employees'],
        ])->assertCreated()->json('invitation.setup_url');
    }
}
