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

class EmployeeOnboardingTest extends TestCase
{
    use RefreshDatabase;

    public function test_hr_admin_can_create_draft_employee_record(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        Sanctum::actingAs($admin);

        $response = $this->postJson('/api/employees', $this->payload([
            'send_invitation' => false,
        ]));

        $response->assertCreated()
            ->assertJsonPath('employee.employee_number', 'EMP-0001')
            ->assertJsonPath('employee.status', 'draft')
            ->assertJsonPath('invitation', null);

        $this->assertDatabaseHas('employees', [
            'organization_id' => $admin->organization_id,
            'employee_number' => 'EMP-0001',
            'work_email' => 'ada@valtireo.test',
            'status' => 'draft',
        ]);

        $employee = Employee::query()->where('employee_number', 'EMP-0001')->firstOrFail();

        $this->assertTrue($employee->profile()->where('completion_status', 'pending')->exists());
    }

    public function test_hr_admin_can_invite_employee_to_complete_profile(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        Sanctum::actingAs($admin);

        $response = $this->postJson('/api/employees', $this->payload([
            'employee_number' => 'EMP-0002',
            'work_email' => 'grace@valtireo.test',
            'send_invitation' => true,
        ]));

        $response->assertCreated()
            ->assertJsonPath('employee.employee_number', 'EMP-0002')
            ->assertJsonPath('employee.status', 'invited')
            ->assertJsonPath('invitation.email', 'grace@valtireo.test')
            ->assertJsonStructure([
                'employee',
                'invitation' => ['id', 'email', 'status', 'expires_at', 'token'],
            ]);

        $employee = Employee::query()->where('employee_number', 'EMP-0002')->firstOrFail();
        $user = User::query()->where('email', 'grace@valtireo.test')->firstOrFail();

        $this->assertSame($user->id, $employee->user_id);
        $this->assertSame($admin->organization_id, $user->organization_id);
        $this->assertTrue($user->hasRole('Employee'));
        $this->assertNotNull($response->json('invitation.token'));
    }

    public function test_employee_role_cannot_create_employee_records(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $employeeUser = User::factory()->create([
            'organization_id' => $admin->organization_id,
            'email' => 'employee-user@valtireo.test',
        ]);
        $employeeUser->assignRole('Employee');

        Sanctum::actingAs($employeeUser);

        $this->postJson('/api/employees', $this->payload())
            ->assertForbidden();
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
            'employee_number' => 'EMP-0001',
            'first_name' => 'Ada',
            'middle_name' => null,
            'last_name' => 'Lovelace',
            'work_email' => 'ada@valtireo.test',
            'phone' => '08012345678',
            'department_id' => $department->id,
            'unit_id' => $unit->id,
            'designation_id' => $designation->id,
            'grade_level_id' => $gradeLevel->id,
            'employment_type_id' => $employmentType->id,
            'organization_location_id' => $location->id,
            'reporting_manager_id' => null,
            'start_date' => '2026-08-02',
            'send_invitation' => true,
            ...$overrides,
        ];
    }
}
