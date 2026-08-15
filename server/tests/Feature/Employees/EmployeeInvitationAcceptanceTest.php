<?php

namespace Tests\Feature\Employees;

use App\Models\Department;
use App\Models\Designation;
use App\Models\EmployeeInvitation;
use App\Models\EmploymentType;
use App\Models\GradeLevel;
use App\Models\Organization;
use App\Models\OrganizationLocation;
use App\Models\Unit;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class EmployeeInvitationAcceptanceTest extends TestCase
{
    use RefreshDatabase;

    public function test_employee_can_accept_invitation_and_set_password(): void
    {
        $token = $this->createInvitedEmployeeAndReturnToken();

        $response = $this->postJson("/api/employee-invitations/{$token}/accept", [
            'password' => 'Password1!',
            'password_confirmation' => 'Password1!',
        ]);

        $response->assertOk()
            ->assertJsonPath('token_type', 'Bearer')
            ->assertJsonPath('employee.status', 'onboarding')
            ->assertJsonPath('profile.completion_status', 'pending')
            ->assertJsonPath('invitation.status', 'accepted');

        $this->assertDatabaseHas('employee_invitations', [
            'email' => 'invitee@valtireo.test',
            'status' => 'accepted',
        ]);

        $this->postJson('/api/auth/login', [
            'email' => 'invitee@valtireo.test',
            'password' => 'Password1!',
        ])->assertOk();
    }

    public function test_employee_can_submit_profile_after_accepting_invitation(): void
    {
        $token = $this->createInvitedEmployeeAndReturnToken();

        $acceptResponse = $this->postJson("/api/employee-invitations/{$token}/accept", [
            'password' => 'Password1!',
            'password_confirmation' => 'Password1!',
        ]);

        Sanctum::actingAs(User::query()->where('email', 'invitee@valtireo.test')->firstOrFail());

        $this->patchJson('/api/me/employee-profile', [
            'date_of_birth' => '1995-01-15',
            'gender' => 'female',
            'personal_email' => 'ada.personal@example.com',
            'residential_address' => '12 Example Street, Lagos',
            'next_of_kin_name' => 'Jane Lovelace',
            'next_of_kin_phone' => '08010000000',
            'emergency_contact_name' => 'Grace Hopper',
            'emergency_contact_phone' => '08020000000',
        ])->assertOk()
            ->assertJsonPath('employee.status', 'onboarding')
            ->assertJsonPath('profile.completion_status', 'submitted')
            ->assertJsonPath('profile.personal_email', 'ada.personal@example.com');

        $this->assertNotNull($acceptResponse->json('token'));
    }

    public function test_expired_invitation_cannot_be_accepted(): void
    {
        $token = $this->createInvitedEmployeeAndReturnToken();

        EmployeeInvitation::query()
            ->where('email', 'invitee@valtireo.test')
            ->update(['expires_at' => now()->subMinute()]);

        $this->postJson("/api/employee-invitations/{$token}/accept", [
            'password' => 'Password1!',
            'password_confirmation' => 'Password1!',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['token']);
    }

    private function createInvitedEmployeeAndReturnToken(): string
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        Sanctum::actingAs($admin);

        $response = $this->postJson('/api/employees', $this->payload());

        $response->assertCreated();

        return $response->json('invitation.token');
    }

    /**
     * @return array<string, mixed>
     */
    private function payload(): array
    {
        $organization = Organization::query()->where('code', 'VALTIREO')->firstOrFail();
        $department = Department::query()->whereBelongsTo($organization)->where('code', 'HR')->firstOrFail();
        $unit = Unit::query()->whereBelongsTo($organization)->where('code', 'HR-REC')->firstOrFail();
        $designation = Designation::query()->whereBelongsTo($organization)->where('code', 'HRO')->firstOrFail();
        $gradeLevel = GradeLevel::query()->whereBelongsTo($organization)->where('code', 'GL03')->firstOrFail();
        $employmentType = EmploymentType::query()->whereBelongsTo($organization)->where('code', 'PERM')->firstOrFail();
        $location = OrganizationLocation::query()->whereBelongsTo($organization)->where('code', 'HQ')->firstOrFail();

        return [
            'employee_number' => 'EMP-ACCEPT-001',
            'first_name' => 'Ada',
            'last_name' => 'Lovelace',
            'work_email' => 'invitee@valtireo.test',
            'phone' => '08012345678',
            'department_id' => $department->id,
            'unit_id' => $unit->id,
            'designation_id' => $designation->id,
            'grade_level_id' => $gradeLevel->id,
            'employment_type_id' => $employmentType->id,
            'organization_location_id' => $location->id,
            'start_date' => '2026-08-02',
            'send_invitation' => true,
        ];
    }
}
