<?php

namespace Tests\Feature\Employees;

use App\Models\Department;
use App\Models\Employee;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class EmployeeListingTest extends TestCase
{
    use RefreshDatabase;

    public function test_hr_admin_can_list_employees_for_their_organization(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        Sanctum::actingAs($admin);

        $this->getJson('/api/employees?per_page=5')
            ->assertOk()
            ->assertJsonStructure([
                'data' => [
                    '*' => [
                        'id',
                        'employee_number',
                        'first_name',
                        'last_name',
                        'work_email',
                        'department',
                        'designation',
                        'employment_type',
                        'location',
                        'profile',
                    ],
                ],
                'links',
                'meta',
            ]);
    }

    public function test_employee_listing_can_be_filtered_by_search_status_and_department(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $department = Department::query()
            ->where('organization_id', $admin->organization_id)
            ->where('code', 'HR')
            ->firstOrFail();

        Sanctum::actingAs($admin);

        $this->getJson("/api/employees?search=mariam&status=active&department_id={$department->id}")
            ->assertOk()
            ->assertJsonPath('data.0.employee_number', 'EMP-HR-001')
            ->assertJsonPath('data.0.department.code', 'HR');
    }

    public function test_employee_listing_can_be_filtered_by_profile_date_and_sorted(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $department = Department::query()
            ->where('organization_id', $admin->organization_id)
            ->where('code', 'HR')
            ->firstOrFail();

        Sanctum::actingAs($admin);

        $this->getJson("/api/employees?department_id={$department->id}&profile_status=approved&date_column=start_date&date_from=2024-01-01&date_to=2026-12-31&sort_by=employee_number&sort_direction=asc&per_page=3")
            ->assertOk()
            ->assertJsonPath('data.0.employee_number', 'EMP-HR-001')
            ->assertJsonPath('data.0.profile.completion_status', 'approved')
            ->assertJsonPath('meta.per_page', 3);
    }

    public function test_hr_admin_can_export_filtered_employee_csv(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $department = Department::query()
            ->where('organization_id', $admin->organization_id)
            ->where('code', 'HR')
            ->firstOrFail();

        Sanctum::actingAs($admin);

        $response = $this->get("/api/employees/export?department_id={$department->id}&profile_status=approved&date_column=start_date&date_from=2024-01-01&date_to=2026-12-31&sort_by=employee_number&sort_direction=asc");

        $response
            ->assertOk()
            ->assertHeader('content-type', 'text/csv; charset=UTF-8')
            ->assertHeader('content-disposition');

        $content = $response->streamedContent();

        $this->assertStringContainsString('"Employee Number","First Name","Middle Name","Last Name","Work Email"', $content);
        $this->assertStringContainsString('EMP-HR-001', $content);
        $this->assertStringNotContainsString('EMP-FIN-001', $content);
    }

    public function test_employee_role_cannot_export_employee_csv(): void
    {
        $this->seed();

        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        Sanctum::actingAs($employeeUser);

        $this->get('/api/employees/export')
            ->assertForbidden();
    }

    public function test_employee_role_cannot_list_all_employees(): void
    {
        $this->seed();

        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        Sanctum::actingAs($employeeUser);

        $this->getJson('/api/employees')
            ->assertForbidden();
    }

    public function test_hr_admin_can_view_one_employee_detail(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $employee = Employee::query()->where('employee_number', 'EMP-HR-001')->firstOrFail();

        Sanctum::actingAs($admin);

        $this->getJson("/api/employees/{$employee->id}")
            ->assertOk()
            ->assertJsonPath('data.employee_number', 'EMP-HR-001')
            ->assertJsonPath('data.department.code', 'HR')
            ->assertJsonStructure([
                'data' => [
                    'id',
                    'employee_number',
                    'user',
                    'department',
                    'unit',
                    'designation',
                    'grade_level',
                    'employment_type',
                    'location',
                    'profile',
                    'invitations',
                ],
            ]);
    }

    public function test_employee_role_cannot_view_other_employee_detail(): void
    {
        $this->seed();

        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        $employee = Employee::query()->where('employee_number', 'EMP-HR-001')->firstOrFail();

        Sanctum::actingAs($employeeUser);

        $this->getJson("/api/employees/{$employee->id}")
            ->assertForbidden();
    }
}
