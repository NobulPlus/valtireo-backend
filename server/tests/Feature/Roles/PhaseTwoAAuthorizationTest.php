<?php

namespace Tests\Feature\Roles;

use App\Models\Department;
use App\Models\Employee;
use App\Models\Role;
use App\Models\User;
use App\Services\EmployeeRoleAssignmentService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class PhaseTwoAAuthorizationTest extends TestCase
{
    use RefreshDatabase;

    public function test_service_requires_assignment_authority_even_for_a_permission_superset(): void
    {
        $this->seed();
        $actor = User::where('email', 'mariam.okafor@valtireo.test')->firstOrFail();
        $this->actingAsInOrganization($actor);
        $actor->roles->first()->revokePermissionTo('employees.assign_role');
        $actor->unsetRelation('roles');
        $role = Role::where('organization_id', $actor->organization_id)->where('key', 'supervisor')->firstOrFail();
        $actor->givePermissionTo('employees.manage_team');
        $target = User::where('email', 'aisha.bello@valtireo.test')->firstOrFail();

        $this->expectException(ValidationException::class);
        app(EmployeeRoleAssignmentService::class)->assertCanAssign($actor, $role, $target);
    }

    public function test_customized_standard_role_cannot_delegate_an_extra_payroll_permission(): void
    {
        $this->seed();
        $actor = User::where('email', 'mariam.okafor@valtireo.test')->firstOrFail();
        $this->actingAsInOrganization($actor);
        $role = Role::where('organization_id', $actor->organization_id)->where('key', 'supervisor')->firstOrFail();
        $role->givePermissionTo('payroll.runs.finalize');
        $employee = Employee::where('work_email', 'aisha.bello@valtireo.test')->firstOrFail();

        $this->patchJson("/api/employees/{$employee->id}", ['pending_role_id' => $role->id])
            ->assertUnprocessable()->assertJsonValidationErrors('pending_role_id');
        $this->assertFalse($employee->user->can('payroll.runs.finalize'));
    }

    public function test_other_standard_keys_and_multiple_actor_roles_do_not_bypass_delegation_limits(): void
    {
        $this->seed();
        $actor = User::where('email', 'mariam.okafor@valtireo.test')->firstOrFail();
        $this->actingAsInOrganization($actor);
        $actor->assignRole('Employee'); // Existing Spatie union, not a new assignment API.
        $role = Role::where('organization_id', $actor->organization_id)->where('key', 'hr_officer')->firstOrFail();
        $role->givePermissionTo('employees.manage_team');
        $employee = Employee::where('work_email', 'aisha.bello@valtireo.test')->firstOrFail();
        $this->patchJson("/api/employees/{$employee->id}", ['pending_role_id' => $role->id])->assertUnprocessable();

        foreach (['supervisor', 'department_head'] as $key) {
            $approved = Role::where('organization_id', $actor->organization_id)->where('key', $key)->firstOrFail();
            $this->patchJson("/api/employees/{$actor->employee->id}", ['pending_role_id' => $approved->id])->assertUnprocessable();
        }
        $this->assertFalse($actor->fresh()->can('employees.manage_team'));
    }

    public function test_manager_eligibility_requires_structure_and_existing_visibility_and_revokes_on_refresh(): void
    {
        $this->seed();
        $actor = User::where('email', 'daniel.adeyemi@valtireo.test')->firstOrFail();
        $this->actingAsInOrganization($actor);
        $employee = $actor->employee;
        Employee::where('organization_id', $actor->organization_id)->where('reporting_manager_id', $employee->id)->update(['reporting_manager_id' => null]);
        $this->getJson('/api/auth/me')->assertOk()->assertJsonPath('has_manager_scope', false);
        $this->getJson('/api/dashboard/manager')->assertForbidden();

        $report = Employee::where('employee_number', 'EMP-OPS-002')->firstOrFail();
        $report->update(['reporting_manager_id' => $employee->id]);
        $this->getJson('/api/auth/me')->assertOk()->assertJsonPath('has_manager_scope', true);
        $this->getJson('/api/dashboard/manager')->assertOk()->assertJsonPath('employees.total', 1);

        $role = $actor->roles->first();
        $role->revokePermissionTo('employees.view_team');
        $actor->unsetRelation('roles');
        $this->getJson('/api/auth/me')->assertOk()->assertJsonPath('has_manager_scope', false);
        $this->getJson('/api/dashboard/manager')->assertForbidden();

        $role->givePermissionTo('employees.view_team');
        $role->revokePermissionTo('employees.manage_team');
        $actor->unsetRelation('roles');
        $this->getJson('/api/auth/me')->assertOk()->assertJsonPath('has_manager_scope', false);
        $this->getJson('/api/dashboard/manager')->assertForbidden();
    }

    public function test_manage_team_alone_grants_neither_dashboard_data_nor_employee_actions(): void
    {
        $this->seed();
        $actor = User::where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        $this->actingAsInOrganization($actor);
        $actor->givePermissionTo('employees.manage_team');
        $report = Employee::where('employee_number', 'EMP-ICT-001')->firstOrFail();
        $report->update(['reporting_manager_id' => $actor->employee->id]);
        $this->getJson('/api/auth/me')->assertOk()->assertJsonPath('has_manager_scope', false);
        $this->getJson('/api/dashboard/manager')->assertForbidden();
        $this->patchJson("/api/employees/{$report->id}", ['first_name' => 'Forbidden'])->assertNotFound();
        $this->getJson('/api/payroll/runs')->assertForbidden();
    }

    public function test_department_visibility_does_not_leak_separately_assigned_direct_reports(): void
    {
        $this->seed();
        $actor = User::where('email', 'daniel.adeyemi@valtireo.test')->firstOrFail();
        $this->actingAsInOrganization($actor);
        $role = Role::create(['organization_id' => $actor->organization_id, 'name' => 'Department only', 'guard_name' => 'web']);
        $role->syncPermissions(['employees.manage_team', 'employees.view_department']);
        $actor->syncRoles([$role]);
        Department::whereKey($actor->employee->department_id)->update(['head_employee_id' => $actor->employee->id]);
        $outside = Employee::where('employee_number', 'EMP-ICT-001')->firstOrFail();
        $outside->update(['reporting_manager_id' => $actor->employee->id]);
        $response = $this->getJson('/api/dashboard/manager')->assertOk();
        $this->assertNotContains($outside->id, collect($response->json('people.direct_reports'))->pluck('id')->all());
        $this->assertNotContains($outside->id, collect($response->json('people.members'))->pluck('id')->all());
    }

    public function test_capability_migration_never_changes_existing_role_grants(): void
    {
        $this->seed();
        $role = Role::where('key', 'supervisor')->firstOrFail();
        $role->revokePermissionTo('employees.manage_team');
        $before = DB::table('role_has_permissions')->orderBy('role_id')->orderBy('permission_id')->get()->toJson();
        $migration = require database_path('migrations/2026_10_19_010000_grant_employees_manage_team_permission_to_default_roles.php');
        $migration->up();
        $migration->up();
        $this->assertSame($before, DB::table('role_has_permissions')->orderBy('role_id')->orderBy('permission_id')->get()->toJson());
    }

    public function test_standard_role_session_contract_with_real_direct_reports(): void
    {
        $this->seed();
        $actor = User::where('email', 'daniel.adeyemi@valtireo.test')->firstOrFail();
        $this->actingAsInOrganization($actor);
        Employee::where('employee_number', 'EMP-OPS-002')->update(['reporting_manager_id' => $actor->employee->id]);
        foreach (Role::where('organization_id', $actor->organization_id)->whereNotNull('key')->get() as $role) {
            $actor->syncRoles([$role]);
            $expected = in_array($role->key, ['organization_admin', 'department_head', 'supervisor'], true);
            $this->getJson('/api/auth/me')->assertOk()
                ->assertJsonStructure(['user', 'organization', 'workspace', 'roles', 'permissions', 'modules', 'has_manager_scope'])
                ->assertJsonPath('has_manager_scope', $expected);
        }
    }

    public function test_delegation_requires_broad_authority_even_when_every_other_target_permission_is_held(): void
    {
        $this->seed();
        $actor = User::where('email', 'mariam.okafor@valtireo.test')->firstOrFail();
        $this->actingAsInOrganization($actor);
        $actor->roles->first()->revokePermissionTo('employees.view_all');
        $actor->unsetRelation('roles');
        $role = Role::where('organization_id', $actor->organization_id)->where('key', 'supervisor')->firstOrFail();
        $target = User::where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        $this->expectException(ValidationException::class);
        app(EmployeeRoleAssignmentService::class)->assertCanAssign($actor, $role, $target);
    }

    public function test_role_from_another_tenant_cannot_be_assigned_to_a_local_employee(): void
    {
        $this->seed();
        $actor = User::where('email', 'mariam.okafor@valtireo.test')->firstOrFail();
        $this->actingAsInOrganization($actor);
        $role = Role::where('organization_id', '!=', $actor->organization_id)->where('key', 'supervisor')->firstOrFail();
        $target = Employee::where('work_email', 'aisha.bello@valtireo.test')->firstOrFail();
        $this->patchJson("/api/employees/{$target->id}", ['pending_role_id' => $role->id])
            ->assertUnprocessable()->assertJsonValidationErrors('pending_role_id');
        $this->assertTrue($target->user->hasRole('Employee'));
    }
}
