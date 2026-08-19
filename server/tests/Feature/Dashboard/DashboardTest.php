<?php

namespace Tests\Feature\Dashboard;

use App\Models\Department;
use App\Models\Employee;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class DashboardTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_view_organization_dashboard_metrics(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        Sanctum::actingAs($admin);

        $this->getJson('/api/dashboard/organization')
            ->assertOk()
            ->assertJsonStructure([
                'filters',
                'employees' => ['total', 'active', 'draft', 'invited', 'onboarding'],
                'onboarding' => ['pending_profiles', 'submitted_profiles', 'approved_profiles', 'pending_invitations', 'accepted_invitations', 'expired_invitations'],
                'structure' => ['departments', 'units', 'locations', 'designations', 'grade_levels', 'employment_types'],
                'modules' => ['available', 'active', 'locked'],
                'breakdowns' => ['by_department', 'by_location', 'by_employment_type', 'by_designation', 'by_status'],
                'trends' => ['onboarding'],
                'recent' => ['employees', 'invitations'],
                'setup_completion',
            ])
            ->assertJsonStructure(['trends' => ['onboarding' => ['grain', 'label', 'date_from', 'date_to', 'entries' => [['key', 'label', 'created', 'invited', 'submitted', 'activated', 'completion_rate']]]]])
            ->assertJsonPath('setup_completion.percentage', 100);
    }

    public function test_organization_dashboard_shows_daily_onboarding_trend_for_a_short_date_range(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        Sanctum::actingAs($admin);

        $this->getJson('/api/dashboard/organization?date_from=2026-08-01&date_to=2026-08-31')
            ->assertOk()
            ->assertJsonPath('filters.date_from', '2026-08-01')
            ->assertJsonPath('filters.date_to', '2026-08-31')
            ->assertJsonPath('trends.onboarding.grain', 'day')
            ->assertJsonPath('trends.onboarding.date_from', '2026-08-01')
            ->assertJsonPath('trends.onboarding.date_to', '2026-08-31')
            ->assertJsonMissingPath('trends.onboarding.entries.30');
    }

    public function test_organization_dashboard_shows_monthly_onboarding_trend_for_a_long_date_range(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        Sanctum::actingAs($admin);

        $this->getJson('/api/dashboard/organization?date_from=2026-01-01&date_to=2026-12-31')
            ->assertOk()
            ->assertJsonPath('trends.onboarding.grain', 'month')
            ->assertJsonPath('trends.onboarding.date_from', '2026-01-01')
            ->assertJsonPath('trends.onboarding.date_to', '2026-12-31');
    }

    public function test_organization_dashboard_accepts_filters_and_sort_options(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $department = Department::query()
            ->where('organization_id', $admin->organization_id)
            ->where('code', 'HR')
            ->firstOrFail();

        Sanctum::actingAs($admin);

        $this->getJson("/api/dashboard/organization?department_id={$department->id}&status=active&date_from=2024-01-01&date_to=2026-12-31&date_column=start_date&sort_by=employee_number&sort_direction=asc&recent_limit=3")
            ->assertOk()
            ->assertJsonPath('filters.department_id', $department->id)
            ->assertJsonPath('filters.status', 'active')
            ->assertJsonPath('filters.date_column', 'start_date')
            ->assertJsonPath('filters.sort_by', 'employee_number')
            ->assertJsonPath('filters.sort_direction', 'asc')
            ->assertJsonPath('filters.recent_limit', 3);
    }

    public function test_employee_can_view_personal_dashboard(): void
    {
        $this->seed();

        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        Sanctum::actingAs($employeeUser);

        $this->getJson('/api/dashboard/me')
            ->assertOk()
            ->assertJsonPath('employee.employee_number', 'EMP-FIN-001')
            ->assertJsonPath('profile.completion_status', 'approved')
            ->assertJsonStructure([
                'employee',
                'organization',
                'work',
                'profile',
                'pending_actions',
                'modules',
            ]);
    }

    public function test_hr_admin_can_view_manager_dashboard_for_selected_department(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $department = Department::query()
            ->where('organization_id', $admin->organization_id)
            ->where('code', 'HR')
            ->firstOrFail();

        Sanctum::actingAs($admin);

        $this->getJson("/api/dashboard/manager?department_id={$department->id}&sort_by=employee_number&sort_direction=asc&recent_limit=5")
            ->assertOk()
            ->assertJsonPath('scope.type', 'department')
            ->assertJsonPath('scope.department.code', 'HR')
            ->assertJsonPath('scope.source', 'requested_department')
            ->assertJsonPath('employees.total', 10)
            ->assertJsonPath('employees.active', 3)
            ->assertJsonStructure([
                'scope',
                'filters',
                'employees',
                'team_health',
                'composition' => ['by_designation', 'by_employment_type', 'by_location', 'by_status'],
                'recent' => ['new_joiners', 'profile_updates'],
                'people' => ['members', 'direct_reports'],
                'leave',
                'attendance',
            ]);
    }

    public function test_supervisor_can_view_direct_reports_dashboard(): void
    {
        $this->seed();

        $supervisorUser = User::query()->where('email', 'daniel.adeyemi@valtireo.test')->firstOrFail();
        $supervisor = Employee::query()->where('work_email', 'daniel.adeyemi@valtireo.test')->firstOrFail();
        $directReport = Employee::query()->where('employee_number', 'EMP-OPS-002')->firstOrFail();

        $directReport->update([
            'reporting_manager_id' => $supervisor->id,
        ]);

        Sanctum::actingAs($supervisorUser);

        $this->getJson('/api/dashboard/manager')
            ->assertOk()
            ->assertJsonPath('scope.type', 'direct_reports')
            ->assertJsonPath('scope.manager.employee_number', 'EMP-OPS-001')
            ->assertJsonPath('employees.total', 1)
            ->assertJsonPath('employees.draft', 1)
            ->assertJsonPath('people.members.0.employee_number', 'EMP-OPS-002')
            ->assertJsonPath('leave.available', true)
            ->assertJsonStructure(['leave' => ['pending_requests', 'approved_requests', 'rejected_requests', 'days_pending', 'days_approved']])
            ->assertJsonPath('attendance.available', true)
            ->assertJsonStructure(['attendance' => ['present', 'late', 'absent', 'corrections_pending', 'duration_minutes']]);
    }

    public function test_employee_without_team_scope_cannot_view_manager_dashboard(): void
    {
        $this->seed();

        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        Sanctum::actingAs($employeeUser);

        $this->getJson('/api/dashboard/manager')
            ->assertForbidden();
    }

    public function test_employee_role_with_a_direct_report_still_cannot_view_manager_dashboard(): void
    {
        $this->seed();

        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        $employee = Employee::query()->where('work_email', 'aisha.bello@valtireo.test')->firstOrFail();
        $someoneElse = Employee::query()->where('employee_number', 'EMP-ICT-001')->firstOrFail();

        // Organizational data alone (a direct report) must never be sufficient —
        // Aisha holds the plain "Employee" role, which has no employees.view_team.
        $someoneElse->update(['reporting_manager_id' => $employee->id]);

        Sanctum::actingAs($employeeUser);

        $this->getJson('/api/dashboard/manager')
            ->assertForbidden();
    }

    public function test_department_head_sees_whole_department_while_supervisor_sees_only_own_reports(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $opsDepartment = Department::query()->where('organization_id', $admin->organization_id)->where('code', 'OPS')->firstOrFail();

        $supervisorUser = User::query()->where('email', 'daniel.adeyemi@valtireo.test')->firstOrFail();
        $supervisor = Employee::query()->where('work_email', 'daniel.adeyemi@valtireo.test')->firstOrFail();
        $directReport = Employee::query()->where('employee_number', 'EMP-OPS-002')->firstOrFail();
        $directReport->update(['reporting_manager_id' => $supervisor->id]);

        $deptHeadUser = User::factory()->create([
            'organization_id' => $admin->organization_id,
            'email' => 'ops-head@valtireo.test',
        ]);
        $deptHeadUser->assignRole('Department Head');
        Employee::factory()->create([
            'organization_id' => $admin->organization_id,
            'user_id' => $deptHeadUser->id,
            'department_id' => $opsDepartment->id,
            'unit_id' => null,
            'designation_id' => $supervisor->designation_id,
            'grade_level_id' => null,
            'employment_type_id' => $supervisor->employment_type_id,
            'organization_location_id' => $supervisor->organization_location_id,
            'reporting_manager_id' => null,
            'status' => 'active',
        ]);

        $opsDepartmentTotal = Employee::query()->where('department_id', $opsDepartment->id)->count();

        Sanctum::actingAs($deptHeadUser);
        $this->getJson('/api/dashboard/manager')
            ->assertOk()
            ->assertJsonPath('scope.type', 'department')
            ->assertJsonPath('scope.department.code', 'OPS')
            ->assertJsonPath('employees.total', $opsDepartmentTotal);

        // A Supervisor inside the same department only ever sees their own
        // reporting-line chain, never the Department Head's whole-department view.
        Sanctum::actingAs($supervisorUser);
        $this->getJson('/api/dashboard/manager')
            ->assertOk()
            ->assertJsonPath('scope.type', 'direct_reports')
            ->assertJsonPath('employees.total', 1)
            ->assertJsonPath('people.members.0.employee_number', 'EMP-OPS-002');
    }

    public function test_organization_admin_without_employee_record_cannot_view_manager_dashboard(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $this->assertNull($admin->employee);

        Sanctum::actingAs($admin);

        $this->getJson('/api/dashboard/manager')
            ->assertForbidden();
    }

    public function test_organization_admin_who_is_also_an_employee_with_reports_can_view_manager_dashboard(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $opsDepartment = Department::query()->where('organization_id', $admin->organization_id)->where('code', 'OPS')->firstOrFail();
        $supervisor = Employee::query()->where('work_email', 'daniel.adeyemi@valtireo.test')->firstOrFail();

        $adminEmployee = Employee::factory()->create([
            'organization_id' => $admin->organization_id,
            'user_id' => $admin->id,
            'department_id' => $opsDepartment->id,
            'unit_id' => null,
            'designation_id' => $supervisor->designation_id,
            'grade_level_id' => null,
            'employment_type_id' => $supervisor->employment_type_id,
            'organization_location_id' => $supervisor->organization_location_id,
            'reporting_manager_id' => null,
            'status' => 'active',
        ]);

        $supervisor->update(['reporting_manager_id' => $adminEmployee->id]);

        Sanctum::actingAs($admin);

        $this->getJson('/api/dashboard/manager')
            ->assertOk()
            ->assertJsonPath('scope.type', 'direct_reports')
            ->assertJsonPath('scope.manager.employee_number', $adminEmployee->employee_number);
    }

    public function test_employee_cannot_view_organization_dashboard(): void
    {
        $this->seed();

        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        Sanctum::actingAs($employeeUser);

        $this->getJson('/api/dashboard/organization')
            ->assertForbidden();
    }
}
