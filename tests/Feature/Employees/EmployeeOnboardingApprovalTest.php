<?php

namespace Tests\Feature\Employees;

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
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class EmployeeOnboardingApprovalTest extends TestCase
{
    use RefreshDatabase;

    public function test_hr_admin_can_approve_submitted_employee_onboarding(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        Sanctum::actingAs($admin);

        $employee = $this->createOnboardingEmployee();
        $employee->profile()->update([
            'completion_status' => 'submitted',
        ]);

        $this->patchJson("/api/employees/{$employee->id}/approve-onboarding")
            ->assertOk()
            ->assertJsonPath('employee.status', 'active')
            ->assertJsonPath('profile.completion_status', 'approved')
            ->assertJsonPath('employee.onboarding_completed_at', fn ($value) => filled($value))
            ->assertJsonPath('employee.activated_at', fn ($value) => filled($value));

        $this->assertDatabaseHas('employees', [
            'id' => $employee->id,
            'status' => 'active',
        ]);

        $this->assertDatabaseHas('employee_profiles', [
            'employee_id' => $employee->id,
            'completion_status' => 'approved',
        ]);
    }

    public function test_employee_user_cannot_approve_onboarding(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        Sanctum::actingAs($admin);

        $employee = $this->createOnboardingEmployee([
            'employee_number' => 'EMP-APPROVE-002',
            'work_email' => 'approval-employee-user@valtireo.test',
        ]);
        $employee->profile()->update(['completion_status' => 'submitted']);

        $employeeUser = User::factory()->create([
            'organization_id' => $admin->organization_id,
        ]);
        $employeeUser->assignRole('Employee');

        Sanctum::actingAs($employeeUser);

        $this->patchJson("/api/employees/{$employee->id}/approve-onboarding")
            ->assertForbidden();
    }

    public function test_submitted_profile_is_required_before_approval(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        Sanctum::actingAs($admin);

        $employee = $this->createOnboardingEmployee([
            'employee_number' => 'EMP-APPROVE-003',
            'work_email' => 'approval-pending@valtireo.test',
        ]);

        $this->patchJson("/api/employees/{$employee->id}/approve-onboarding")
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['employee']);
    }

    public function test_employee_must_be_in_onboarding_before_approval(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        Sanctum::actingAs($admin);

        $employee = $this->createOnboardingEmployee([
            'employee_number' => 'EMP-APPROVE-004',
            'work_email' => 'approval-draft@valtireo.test',
        ]);
        $employee->update(['status' => 'draft']);
        $employee->profile()->update(['completion_status' => 'submitted']);

        $this->patchJson("/api/employees/{$employee->id}/approve-onboarding")
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['employee']);
    }

    /**
     * @param array<string, mixed> $overrides
     */
    private function createOnboardingEmployee(array $overrides = []): Employee
    {
        $response = $this->postJson('/api/employees', $this->payload($overrides));

        $response->assertCreated();

        $employee = Employee::query()->findOrFail($response->json('employee.id'));
        $employee->update([
            'status' => 'onboarding',
        ]);

        return $employee->refresh();
    }

    /**
     * @param array<string, mixed> $overrides
     *
     * @return array<string, mixed>
     */
    private function payload(array $overrides = []): array
    {
        $organization = Organization::query()->where('code', 'VALTIREO')->firstOrFail();
        $department = Department::query()->whereBelongsTo($organization)->where('code', 'HR')->firstOrFail();
        $unit = Unit::query()->whereBelongsTo($organization)->where('code', 'HR-REC')->firstOrFail();
        $designation = Designation::query()->whereBelongsTo($organization)->where('code', 'HRO')->firstOrFail();
        $gradeLevel = GradeLevel::query()->whereBelongsTo($organization)->where('code', 'GL03')->firstOrFail();
        $employmentType = EmploymentType::query()->whereBelongsTo($organization)->where('code', 'PERM')->firstOrFail();
        $location = OrganizationLocation::query()->whereBelongsTo($organization)->where('code', 'HQ')->firstOrFail();

        return [
            'employee_number' => 'EMP-APPROVE-001',
            'first_name' => 'Ada',
            'last_name' => 'Lovelace',
            'work_email' => 'approval@valtireo.test',
            'phone' => '08012345678',
            'department_id' => $department->id,
            'unit_id' => $unit->id,
            'designation_id' => $designation->id,
            'grade_level_id' => $gradeLevel->id,
            'employment_type_id' => $employmentType->id,
            'organization_location_id' => $location->id,
            'start_date' => '2026-08-02',
            'send_invitation' => false,
            ...$overrides,
        ];
    }
}
