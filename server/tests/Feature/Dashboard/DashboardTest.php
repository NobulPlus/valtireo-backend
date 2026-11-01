<?php

namespace Tests\Feature\Dashboard;

use App\Models\ApprovalRequest;
use App\Models\AttendanceRecord;
use App\Models\Cluster;
use App\Models\Department;
use App\Models\Designation;
use App\Models\Employee;
use App\Models\EmploymentType;
use App\Models\GradeLevel;
use App\Models\LeaveRequest;
use App\Models\LeaveType;
use App\Models\Organization;
use App\Models\OrganizationLocation;
use App\Models\Role;
use App\Models\Unit;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
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
                'structure' => ['departments', 'units', 'clusters', 'clusters_with_manager', 'clusters_with_supervisor', 'employees_without_cluster', 'locations', 'designations', 'grade_levels', 'employment_types'],
                'modules' => ['available', 'active', 'locked'],
                'approvals' => ['pending', 'needs_attention'],
                'service_desk' => ['open', 'unassigned', 'sla_breached'],
                'leave' => ['pending', 'upcoming'],
                'attendance' => ['present', 'late', 'absent'],
                'documents' => ['missing', 'expiring_soon', 'expired'],
                'breakdowns' => ['by_department', 'by_cluster', 'by_location', 'by_employment_type', 'by_designation', 'by_status'],
                'trends' => ['onboarding'],
                'recent' => ['employees', 'invitations'],
                'setup_completion',
            ])
            ->assertJsonStructure(['trends' => ['onboarding' => ['grain', 'label', 'date_from', 'date_to', 'entries' => [['key', 'label', 'created', 'invited', 'submitted', 'activated', 'completion_rate']]]]])
            ->assertJsonPath('setup_completion.percentage', 100);
    }

    public function test_organization_dashboard_reflects_approvals_leave_and_attendance_counts(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $employee = Employee::query()->where('employee_number', 'EMP-FIN-001')->firstOrFail();
        $leaveType = LeaveType::query()->where('organization_id', $admin->organization_id)->firstOrFail();

        Sanctum::actingAs($admin);
        $baseline = $this->getJson('/api/dashboard/organization')->json();

        ApprovalRequest::query()->create([
            'organization_id' => $admin->organization_id,
            'subject_employee_id' => $employee->id,
            'approvable_type' => 'App\\Models\\LeaveRequest',
            'approvable_id' => 1,
            'module' => 'leave',
            'action' => 'request',
            'title' => 'Test approval',
            'status' => 'pending',
        ]);

        LeaveRequest::query()->create([
            'organization_id' => $admin->organization_id,
            'employee_id' => $employee->id,
            'leave_type_id' => $leaveType->id,
            'starts_on' => now()->addDays(2)->toDateString(),
            'ends_on' => now()->addDays(3)->toDateString(),
            'total_days' => 2,
            'status' => 'submitted',
        ]);

        AttendanceRecord::query()->updateOrCreate(
            ['employee_id' => $employee->id, 'attendance_date' => now()->toDateString()],
            ['organization_id' => $admin->organization_id, 'status' => 'late'],
        );

        $this->getJson('/api/dashboard/organization')
            ->assertOk()
            ->assertJsonPath('approvals.pending', $baseline['approvals']['pending'] + 1)
            ->assertJsonPath('leave.pending', $baseline['leave']['pending'] + 1)
            ->assertJsonPath('attendance.late', $baseline['attendance']['late'] + 1);
    }

    public function test_organization_dashboard_breakdowns_include_locations_with_no_employees_yet(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();

        OrganizationLocation::query()->where('organization_id', $admin->organization_id)->update(['is_primary' => false]);
        $primary = OrganizationLocation::query()->create([
            'organization_id' => $admin->organization_id,
            'name' => 'Kano Branch',
            'code' => 'KANO',
            'type' => 'branch',
            'is_primary' => true,
            'is_active' => true,
        ]);
        $empty = OrganizationLocation::query()->create([
            'organization_id' => $admin->organization_id,
            'name' => 'Port Harcourt Branch',
            'code' => 'PHC',
            'type' => 'branch',
            'is_primary' => false,
            'is_active' => true,
        ]);

        Sanctum::actingAs($admin);

        $response = $this->getJson('/api/dashboard/organization')->assertOk();
        $locations = collect($response->json('breakdowns.by_location'));

        $emptyEntry = $locations->firstWhere('id', $empty->id);
        $this->assertNotNull($emptyEntry, 'A location with zero employees should still appear on the dashboard.');
        $this->assertSame(0, $emptyEntry['total']);
        $this->assertSame($primary->id, $locations->first()['id'], 'The primary location should be sorted first.');
        $this->assertTrue($locations->first()['is_primary']);
    }

    public function test_deactivated_locations_are_excluded_from_structure_counts_and_breakdowns(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        Sanctum::actingAs($admin);

        $before = $this->getJson('/api/dashboard/organization')->assertOk();
        $baselineCount = $before->json('structure.locations');

        $inactive = OrganizationLocation::query()->create([
            'organization_id' => $admin->organization_id,
            'name' => 'Retired Branch',
            'code' => 'RETIRED',
            'type' => 'branch',
            'is_active' => false,
        ]);

        $response = $this->getJson('/api/dashboard/organization')->assertOk();

        $this->assertSame($baselineCount, $response->json('structure.locations'), 'Deactivated locations should not inflate the structure count.');
        $this->assertNull(collect($response->json('breakdowns.by_location'))->firstWhere('id', $inactive->id), 'Deactivated locations should not appear in the dashboard breakdown.');
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
                'leave',
                'attendance' => ['trend', 'range' => ['date_from', 'date_to'], 'corrections_pending', 'this_month' => ['present', 'late', 'absent', 'total_hours']],
                'document_compliance',
                'next_holiday',
                'tenure',
            ]);
    }

    public function test_organization_dashboard_reflects_service_desk_counts(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();

        Sanctum::actingAs($admin);
        $baseline = $this->getJson('/api/dashboard/organization')->json();

        Sanctum::actingAs($employeeUser);
        $categoryId = \App\Models\TicketCategory::query()
            ->where('organization_id', $employeeUser->organization_id)
            ->where('code', 'IT')
            ->value('id');
        $this->postJson('/api/tickets', [
            'ticket_category_id' => $categoryId,
            'subject' => 'Dashboard count test',
            'description' => 'Should bump open + unassigned counts.',
        ])->assertCreated();

        Sanctum::actingAs($admin);
        $this->getJson('/api/dashboard/organization')
            ->assertOk()
            ->assertJsonPath('service_desk.open', $baseline['service_desk']['open'] + 1)
            ->assertJsonPath('service_desk.unassigned', $baseline['service_desk']['unassigned'] + 1);
    }

    public function test_employee_dashboard_shows_pending_action_for_an_open_ticket(): void
    {
        $this->seed();

        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        Sanctum::actingAs($employeeUser);

        $this->getJson('/api/dashboard/me')->assertOk()->assertJsonMissing(['key' => 'ticket_pending']);

        $categoryId = \App\Models\TicketCategory::query()
            ->where('organization_id', $employeeUser->organization_id)
            ->where('code', 'IT')
            ->value('id');
        $this->postJson('/api/tickets', [
            'ticket_category_id' => $categoryId,
            'subject' => 'Pending action test',
            'description' => 'Should surface as a pending action.',
        ])->assertCreated();

        $this->getJson('/api/dashboard/me')->assertOk()->assertJsonFragment(['key' => 'ticket_pending']);
    }

    public function test_personal_dashboard_attendance_trend_defaults_to_last_7_days_and_respects_a_custom_range(): void
    {
        $this->seed();

        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        Sanctum::actingAs($employeeUser);

        $today = \Carbon\CarbonImmutable::today();

        $default = $this->getJson('/api/dashboard/me')->assertOk();
        $this->assertSame($today->subDays(6)->toDateString(), $default->json('attendance.range.date_from'));
        $this->assertSame($today->toDateString(), $default->json('attendance.range.date_to'));
        $this->assertCount(7, $default->json('attendance.trend'));

        $dateFrom = $today->subDays(29)->toDateString();
        $dateTo = $today->toDateString();
        $widened = $this->getJson("/api/dashboard/me?date_from={$dateFrom}&date_to={$dateTo}")->assertOk();
        $this->assertSame($dateFrom, $widened->json('attendance.range.date_from'));
        $this->assertSame($dateTo, $widened->json('attendance.range.date_to'));
        $this->assertCount(30, $widened->json('attendance.trend'));
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

    public function test_cluster_leader_gets_cluster_scoped_manager_dashboard(): void
    {
        $this->seed();

        $leaderUser = User::query()->where('email', 'daniel.adeyemi@valtireo.test')->firstOrFail();
        $leader = Employee::query()->where('work_email', 'daniel.adeyemi@valtireo.test')->firstOrFail();
        $department = $leader->department;
        $member = Employee::query()
            ->where('organization_id', $leader->organization_id)
            ->where('department_id', $department->id)
            ->whereKeyNot($leader->id)
            ->firstOrFail();

        $cluster = Cluster::query()->create([
            'organization_id' => $leader->organization_id,
            'department_id' => $department->id,
            'manager_employee_id' => $leader->id,
            'name' => 'Operations West',
            'code' => 'OPS-WEST',
        ]);

        $leader->update(['cluster_id' => $cluster->id]);
        $member->update(['cluster_id' => $cluster->id]);

        Sanctum::actingAs($leaderUser);

        $this->getJson('/api/dashboard/manager')
            ->assertOk()
            ->assertJsonPath('scope.type', 'cluster')
            ->assertJsonPath('scope.cluster.code', 'OPS-WEST')
            ->assertJsonPath('scope.source', 'cluster_leadership_assignment')
            ->assertJsonPath('employees.total', 2);

        Sanctum::actingAs(User::query()->where('email', 'admin@valtireo.test')->firstOrFail());

        $this->getJson('/api/dashboard/organization')
            ->assertOk()
            ->assertJsonPath('structure.clusters', 1)
            ->assertJsonPath('structure.clusters_with_manager', 1)
            ->assertJsonPath('breakdowns.by_cluster.0.code', 'OPS-WEST')
            ->assertJsonPath('breakdowns.by_cluster.0.manager.employee_number', $leader->employee_number);
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
        $this->setPermissionsTeamId($admin->organization_id);
        $deptHeadUser->assignRole('Department Head');
        $deptHeadEmployee = Employee::factory()->create([
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
        $opsDepartment->update(['head_employee_id' => $deptHeadEmployee->id]);

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

    public function test_organization_admin_who_is_also_an_employee_gets_department_scope_when_assigned_as_department_head(): void
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
        $opsDepartment->update(['head_employee_id' => $adminEmployee->id]);

        $supervisor->update(['reporting_manager_id' => $adminEmployee->id]);

        Sanctum::actingAs($admin);

        // Department scope requires both access permission and explicit
        // assignment as the department head; the role alone is no longer enough.
        $this->getJson('/api/dashboard/manager')
            ->assertOk()
            ->assertJsonPath('scope.type', 'department')
            ->assertJsonPath('scope.department.code', 'OPS');
    }

    /**
     * Phase 2A: holding employees.view_team/view_all/view_department (all
     * still fully intact for these roles — unchanged by this phase) is NOT
     * employees.manage_team, and must not grant access to /dashboard/manager,
     * which — unlike the ordinary employee list — is specifically a
     * people-MANAGEMENT view, not merely an employee-VISIBILITY one.
     */
    public function test_hr_officer_cannot_view_manager_dashboard_despite_team_visibility(): void
    {
        $this->seed();

        $hrOfficer = User::query()->where('email', 'kelechi.nwosu@valtireo.test')->firstOrFail();
        $this->setPermissionsTeamId($hrOfficer->organization_id);
        $this->assertTrue($hrOfficer->can('employees.view_team'));

        Sanctum::actingAs($hrOfficer);

        $this->getJson('/api/dashboard/manager')
            ->assertForbidden();
    }

    public function test_compliance_officer_cannot_view_manager_dashboard_despite_organization_wide_employee_visibility(): void
    {
        $this->seed();

        $complianceOfficer = User::query()->where('email', 'fatima.yusuf@valtireo.test')->firstOrFail();
        $this->setPermissionsTeamId($complianceOfficer->organization_id);
        $this->assertTrue($complianceOfficer->can('employees.view_all'));

        Sanctum::actingAs($complianceOfficer);

        $this->getJson('/api/dashboard/manager')
            ->assertForbidden();
    }

    /**
     * Tenant isolation for the manager dashboard, specifically for the new
     * permission: two freshly created, unrelated organizations each get
     * their own Department Head (same role key, same permission, entirely
     * separate Role rows per Organization's own tenant). Each must see only
     * their own organization's employees — never the other's — proving the
     * organization-scoped query in DashboardService::manager() stays
     * correctly bounded regardless of which permission gates entry to it.
     */
    public function test_manager_dashboard_scope_never_crosses_into_a_different_organizations_employees(): void
    {
        $this->seed(RolePermissionSeeder::class);

        $organizationA = Organization::query()->create([
            'name' => 'Tenant A', 'code' => 'TENANTA'.uniqid(), 'status' => 'active', 'country' => 'Nigeria', 'settings' => [],
        ]);
        $organizationB = Organization::query()->create([
            'name' => 'Tenant B', 'code' => 'TENANTB'.uniqid(), 'status' => 'active', 'country' => 'Nigeria', 'settings' => [],
        ]);

        [$headA, $otherA] = $this->seedDepartmentHeadWithReports($organizationA, reportCount: 2);
        [$headB] = $this->seedDepartmentHeadWithReports($organizationB, reportCount: 5);

        Sanctum::actingAs($headA);

        $this->getJson('/api/dashboard/manager')
            ->assertOk()
            ->assertJsonPath('employees.total', 3); // the head themself + 2 reports, never B's 6

        Sanctum::actingAs($headB);

        $this->getJson('/api/dashboard/manager')
            ->assertOk()
            ->assertJsonPath('employees.total', 6); // the head themself + 5 reports, never A's 3
    }

    /**
     * @return array{0: User, 1: array<int, Employee>}
     */
    private function seedDepartmentHeadWithReports(Organization $organization, int $reportCount): array
    {
        $this->setPermissionsTeamId($organization->id);
        $role = Role::create(['organization_id' => $organization->id, 'guard_name' => 'web', 'key' => null, 'name' => 'Department Head']);
        $role->syncPermissions(['employees.manage_team', 'employees.view_department']);

        // Several lookup factories (Unit, EmploymentType, GradeLevel, ...)
        // draw from a small fake()->unique() pool (as few as 5 values) that
        // a Faker "unique" tracker never resets mid-process — creating one
        // shared set per organization and passing it explicitly to every
        // Employee::factory() call below avoids each employee silently
        // triggering its own fresh nested factory call, which would
        // exhaust that pool after only a handful of employees.
        $unit = Unit::factory()->create(['organization_id' => $organization->id]);
        $designation = Designation::factory()->create(['organization_id' => $organization->id]);
        $gradeLevel = GradeLevel::factory()->create(['organization_id' => $organization->id]);
        $employmentType = EmploymentType::factory()->create(['organization_id' => $organization->id]);
        $location = OrganizationLocation::factory()->create(['organization_id' => $organization->id]);

        $headUser = User::factory()->create(['organization_id' => $organization->id]);
        $headUser->syncRoles([$role]);
        $department = Department::factory()->create(['organization_id' => $organization->id]);
        $headEmployee = Employee::factory()->create([
            'organization_id' => $organization->id,
            'user_id' => $headUser->id,
            'department_id' => $department->id,
            'unit_id' => $unit->id,
            'designation_id' => $designation->id,
            'grade_level_id' => $gradeLevel->id,
            'employment_type_id' => $employmentType->id,
            'organization_location_id' => $location->id,
            'status' => 'active',
        ]);
        $department->update(['head_employee_id' => $headEmployee->id]);

        $reports = [];
        for ($i = 0; $i < $reportCount; $i++) {
            $reports[] = Employee::factory()->create([
                'organization_id' => $organization->id,
                'department_id' => $department->id,
                'unit_id' => $unit->id,
                'designation_id' => $designation->id,
                'grade_level_id' => $gradeLevel->id,
                'employment_type_id' => $employmentType->id,
                'organization_location_id' => $location->id,
                'status' => 'active',
            ]);
        }

        return [$headUser, $reports];
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
