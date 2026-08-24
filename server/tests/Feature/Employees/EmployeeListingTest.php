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

    public function test_employee_listing_can_be_filtered_to_department_manager_roles(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $this->setPermissionsTeamId($admin->organization_id);
        $manager = Employee::query()
            ->where('organization_id', $admin->organization_id)
            ->whereHas('user.roles', fn ($query) => $query->whereIn('name', ['Department Head', 'Supervisor']))
            ->whereNotNull('department_id')
            ->firstOrFail();

        Sanctum::actingAs($admin);

        $response = $this->getJson("/api/employees?department_id={$manager->department_id}&manager_roles_only=1")
            ->assertOk();

        $this->assertNotEmpty($response->json('data'));

        foreach ($response->json('data') as $employee) {
            $this->assertSame($manager->department_id, $employee['department']['id']);
            $this->assertNotEmpty(array_intersect(['Department Head', 'Supervisor'], $employee['user']['roles']));
        }
    }

    public function test_org_chart_marks_department_head_permission_holders_and_reporting_lines(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $this->setPermissionsTeamId($admin->organization_id);

        $hrDirector = Employee::query()->where('employee_number', 'EMP-HR-001')->firstOrFail();
        $hrOfficer = Employee::query()->where('employee_number', 'EMP-HR-002')->firstOrFail();
        $hrOfficer->update(['reporting_manager_id' => $hrDirector->id, 'status' => 'active']);
        $hrDirector->update(['status' => 'active']);

        Sanctum::actingAs($admin);

        $response = $this->getJson('/api/employees/org-chart')->assertOk();
        $nodes = collect($response->json('employees'))->keyBy('id');

        $this->assertTrue($nodes[$hrDirector->id]['is_department_head']);
        $this->assertSame($hrDirector->id, $nodes[$hrOfficer->id]['reporting_manager_id']);
        $this->assertFalse($nodes[$hrOfficer->id]['is_department_head']);

        foreach ($nodes as $node) {
            $this->assertSame('active', Employee::query()->find($node['id'])->status);
        }
    }

    public function test_org_chart_access_for_an_ordinary_employee_follows_the_show_org_chart_setting(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();

        Sanctum::actingAs($admin);
        $this->patchJson('/api/workspace/settings', [
            'employee_experience' => ['show_org_chart' => false],
        ])->assertOk();

        // Re-fetched fresh each time: Sanctum::actingAs() pins the exact PHP
        // object as the request's user, and a stale cached ->organization
        // relation would otherwise still show the pre-update setting.
        Sanctum::actingAs(User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail());
        $this->getJson('/api/employees/org-chart')->assertForbidden();

        Sanctum::actingAs($admin);
        $this->patchJson('/api/workspace/settings', [
            'employee_experience' => ['show_org_chart' => true],
        ])->assertOk();

        Sanctum::actingAs(User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail());
        $this->getJson('/api/employees/org-chart')->assertOk();
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
                    'profile' => [
                        'id',
                        'date_of_birth',
                        'gender',
                        'personal_email',
                        'residential_address',
                        'next_of_kin_name',
                        'next_of_kin_phone',
                        'emergency_contact_name',
                        'emergency_contact_phone',
                        'completion_status',
                        'passport_photo_url',
                    ],
                    'invitations',
                ],
            ]);
    }

    public function test_hr_admin_can_update_employee_biodata(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $employee = Employee::query()->where('employee_number', 'EMP-HR-001')->firstOrFail();

        Sanctum::actingAs($admin);

        $this->patchJson("/api/employees/{$employee->id}", [
            'profile' => [
                'date_of_birth' => '1992-05-14',
                'gender' => 'female',
                'personal_email' => 'mariam.personal@example.com',
                'residential_address' => '24 Marina Road, Lagos',
                'next_of_kin_name' => 'Tunde Yusuf',
                'next_of_kin_phone' => '08030000000',
                'emergency_contact_name' => 'Amina Yusuf',
                'emergency_contact_phone' => '08031111111',
            ],
        ])
            ->assertOk()
            ->assertJsonPath('data.profile.gender', 'female')
            ->assertJsonPath('data.profile.personal_email', 'mariam.personal@example.com')
            ->assertJsonPath('data.profile.next_of_kin_name', 'Tunde Yusuf')
            ->assertJsonPath('data.profile.emergency_contact_phone', '08031111111');
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
