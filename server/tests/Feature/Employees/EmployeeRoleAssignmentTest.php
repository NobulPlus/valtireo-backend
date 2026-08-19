<?php

namespace Tests\Feature\Employees;

use App\Models\Department;
use App\Models\Designation;
use App\Models\Employee;
use App\Models\EmploymentType;
use App\Models\GradeLevel;
use App\Models\Organization;
use App\Models\OrganizationLocation;
use App\Models\Role;
use App\Models\Unit;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class EmployeeRoleAssignmentTest extends TestCase
{
    use RefreshDatabase;

    public function test_invite_without_a_chosen_pending_role_still_defaults_to_employee(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        Sanctum::actingAs($admin);

        $this->postJson('/api/employees', $this->payload([
            'employee_number' => 'EMP-ROLE-001',
            'work_email' => 'role-default@valtireo.test',
        ]))->assertCreated();

        $user = User::query()->where('email', 'role-default@valtireo.test')->firstOrFail();
        $this->assertTrue($user->hasRole('Employee'));
        $this->assertCount(1, $user->roles);
    }

    public function test_hr_director_can_invite_an_employee_with_an_explicit_supervisor_role(): void
    {
        $this->seed();

        $hrDirector = User::query()->where('email', 'mariam.okafor@valtireo.test')->firstOrFail();
        Sanctum::actingAs($hrDirector);

        $this->postJson('/api/employees', $this->payload([
            'employee_number' => 'EMP-ROLE-002',
            'work_email' => 'role-supervisor@valtireo.test',
            'pending_role_id' => $this->roleId('supervisor'),
        ]))->assertCreated();

        $user = User::query()->where('email', 'role-supervisor@valtireo.test')->firstOrFail();
        $this->assertTrue($user->hasRole('Supervisor'));
        $this->assertFalse($user->hasRole('Employee'));

        // Role assignment is recorded on the employee's own activity
        // timeline (via EmployeeProfileActivityService), not a separate,
        // unsurfaced log — so it shows up wherever the rest of an
        // employee's lifecycle history does.
        $employee = Employee::query()->where('employee_number', 'EMP-ROLE-002')->firstOrFail();
        $this->getJson("/api/employees/{$employee->id}/profile-activities")
            ->assertOk()
            ->assertJsonFragment(['event' => 'employee_role_assigned']);
    }

    public function test_designation_alone_never_grants_elevated_access(): void
    {
        $this->seed();

        $hrDirector = User::query()->where('email', 'mariam.okafor@valtireo.test')->firstOrFail();
        $organization = Organization::query()->where('code', 'VALTIREO')->firstOrFail();
        $departmentHeadDesignation = Designation::query()->whereBelongsTo($organization)->where('code', 'DH')->firstOrFail();

        Sanctum::actingAs($hrDirector);

        // "Department Head" designation (job title) — no pending_role_id chosen.
        $this->postJson('/api/employees', $this->payload([
            'employee_number' => 'EMP-ROLE-003',
            'work_email' => 'role-designation@valtireo.test',
            'designation_id' => $departmentHeadDesignation->id,
        ]))->assertCreated();

        $user = User::query()->where('email', 'role-designation@valtireo.test')->firstOrFail();
        $this->assertTrue($user->hasRole('Employee'));
        $this->assertFalse($user->hasRole('Department Head'));
    }

    public function test_changing_designation_on_update_does_not_change_the_assigned_role(): void
    {
        $this->seed();

        $hrDirector = User::query()->where('email', 'mariam.okafor@valtireo.test')->firstOrFail();
        $organization = Organization::query()->where('code', 'VALTIREO')->firstOrFail();
        $officerDesignation = Designation::query()->whereBelongsTo($organization)->where('code', 'OFF')->firstOrFail();

        Sanctum::actingAs($hrDirector);

        $this->postJson('/api/employees', $this->payload([
            'employee_number' => 'EMP-ROLE-004',
            'work_email' => 'role-stable@valtireo.test',
            'pending_role_id' => $this->roleId('supervisor'),
        ]))->assertCreated();

        $employee = Employee::query()->where('employee_number', 'EMP-ROLE-004')->firstOrFail();

        $this->patchJson("/api/employees/{$employee->id}", [
            'designation_id' => $officerDesignation->id,
        ])->assertOk();

        $user = User::query()->where('email', 'role-stable@valtireo.test')->firstOrFail();
        $this->assertTrue($user->hasRole('Supervisor'));
    }

    public function test_hr_director_can_update_an_existing_employees_pending_role(): void
    {
        $this->seed();

        $hrDirector = User::query()->where('email', 'mariam.okafor@valtireo.test')->firstOrFail();
        Sanctum::actingAs($hrDirector);

        $this->postJson('/api/employees', $this->payload([
            'employee_number' => 'EMP-ROLE-005',
            'work_email' => 'role-promoted@valtireo.test',
        ]))->assertCreated();

        $employee = Employee::query()->where('employee_number', 'EMP-ROLE-005')->firstOrFail();

        $this->patchJson("/api/employees/{$employee->id}", [
            'pending_role_id' => $this->roleId('department_head'),
        ])->assertOk();

        $user = User::query()->where('email', 'role-promoted@valtireo.test')->firstOrFail();
        $this->assertTrue($user->hasRole('Department Head'));
        $this->assertFalse($user->hasRole('Employee'));
    }

    public function test_hr_officer_cannot_change_an_employees_pending_role(): void
    {
        $this->seed();

        $hrOfficer = User::query()->where('email', 'kelechi.nwosu@valtireo.test')->firstOrFail();
        $employee = Employee::query()->where('employee_number', 'EMP-FIN-001')->firstOrFail();

        Sanctum::actingAs($hrOfficer);

        $this->patchJson("/api/employees/{$employee->id}", [
            'pending_role_id' => $this->roleId('supervisor'),
        ])->assertForbidden();
    }

    public function test_hr_officer_can_still_update_other_fields_without_touching_role(): void
    {
        $this->seed();

        $hrOfficer = User::query()->where('email', 'kelechi.nwosu@valtireo.test')->firstOrFail();
        $employee = Employee::query()->where('employee_number', 'EMP-FIN-001')->firstOrFail();

        Sanctum::actingAs($hrOfficer);

        $this->patchJson("/api/employees/{$employee->id}", [
            'phone' => '08099999999',
        ])->assertOk();
    }

    public function test_non_organization_admin_cannot_assign_the_organization_admin_role(): void
    {
        $this->seed();

        $hrDirector = User::query()->where('email', 'mariam.okafor@valtireo.test')->firstOrFail();
        Sanctum::actingAs($hrDirector);

        // HR Director holds employees.assign_role (so the endpoint itself is
        // reachable) but not every permission Organization Admin's role
        // carries — the generalized escalation rule in
        // EmployeeRoleAssignmentService blocks it on that permission-subset
        // check, not on any hardcoded role name.
        $this->postJson('/api/employees', $this->payload([
            'employee_number' => 'EMP-ROLE-006',
            'work_email' => 'role-escalation@valtireo.test',
            'pending_role_id' => $this->roleId('organization_admin'),
        ]))->assertUnprocessable()
            ->assertJsonValidationErrors(['pending_role_id']);

        $this->assertDatabaseMissing('users', ['email' => 'role-escalation@valtireo.test']);
    }

    public function test_organization_admin_can_assign_the_organization_admin_role(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        Sanctum::actingAs($admin);

        $this->postJson('/api/employees', $this->payload([
            'employee_number' => 'EMP-ROLE-007',
            'work_email' => 'role-new-admin@valtireo.test',
            'pending_role_id' => $this->roleId('organization_admin'),
        ]))->assertCreated();

        $user = User::query()->where('email', 'role-new-admin@valtireo.test')->firstOrFail();
        $this->assertTrue($user->hasRole('Organization Admin'));
    }

    public function test_an_invalid_role_id_is_rejected_even_for_an_organization_admin(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        Sanctum::actingAs($admin);

        // Platform authority (is_platform_admin) has no relationship to the
        // Role system at all — there's no "Super Admin" role id to even
        // attempt sending, so the remaining escalation surface to check is
        // injecting a role id that doesn't correspond to any real,
        // assignable role, even as the organization's own top administrator.
        $this->postJson('/api/employees', $this->payload([
            'employee_number' => 'EMP-ROLE-008',
            'work_email' => 'role-invalid@valtireo.test',
            'pending_role_id' => 999999999,
        ]))->assertUnprocessable()
            ->assertJsonValidationErrors(['pending_role_id']);
    }

    public function test_organization_a_cannot_change_role_for_an_employee_in_organization_b(): void
    {
        $this->seed();

        $tenantB = $this->createTenantBEmployee();
        $hrDirector = User::query()->where('email', 'mariam.okafor@valtireo.test')->firstOrFail();

        Sanctum::actingAs($hrDirector);

        $this->patchJson("/api/employees/{$tenantB->id}", [
            'pending_role_id' => $this->roleId('supervisor'),
        ])->assertNotFound();
    }

    public function test_assignable_roles_lookup_reflects_actor_permissions(): void
    {
        $this->seed();

        $hrDirector = User::query()->where('email', 'mariam.okafor@valtireo.test')->firstOrFail();
        Sanctum::actingAs($hrDirector);

        // /setup/assignable-roles now returns role ids as the option value
        // (roles are freely renameable, so names can't be the wire
        // identifier) — assert against the label instead.
        $response = $this->getJson('/api/setup/assignable-roles')->assertOk();
        $labels = collect($response->json('data'))->pluck('label');

        $this->assertTrue($labels->contains('Supervisor'));
        $this->assertFalse($labels->contains('Organization Admin'));

        $hrOfficer = User::query()->where('email', 'kelechi.nwosu@valtireo.test')->firstOrFail();
        Sanctum::actingAs($hrOfficer);

        $this->getJson('/api/setup/assignable-roles')
            ->assertOk()
            ->assertJsonPath('data', []);
    }

    private function roleId(string $key): int
    {
        $organization = Organization::query()->where('code', 'VALTIREO')->firstOrFail();

        return Role::query()
            ->where('organization_id', $organization->id)
            ->where('key', $key)
            ->firstOrFail()
            ->id;
    }

    private function createTenantBEmployee(): Employee
    {
        $organization = Organization::factory()->create(['code' => 'BETA-ROLE']);
        $location = OrganizationLocation::factory()->create(['organization_id' => $organization->id]);
        $department = Department::factory()->create(['organization_id' => $organization->id]);
        $unit = Unit::factory()->create(['organization_id' => $organization->id, 'department_id' => $department->id]);
        $designation = Designation::factory()->create(['organization_id' => $organization->id]);
        $gradeLevel = GradeLevel::factory()->create(['organization_id' => $organization->id]);
        $employmentType = EmploymentType::factory()->create(['organization_id' => $organization->id]);

        return Employee::factory()->create([
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
            'employee_number' => 'EMP-ROLE-000',
            'first_name' => 'Test',
            'middle_name' => null,
            'last_name' => 'Employee',
            'work_email' => 'role-test@valtireo.test',
            'phone' => '08012340000',
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
