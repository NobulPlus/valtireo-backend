<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class RolePermissionSeeder extends Seeder
{
    /**
     * Seed the application's roles and permissions.
     */
    public function run(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        foreach ($this->permissions() as $permission) {
            Permission::query()->firstOrCreate([
                'name' => $permission,
                'guard_name' => 'web',
            ]);
        }

        foreach ($this->rolePermissions() as $roleName => $permissions) {
            $role = Role::query()->firstOrCreate([
                'name' => $roleName,
                'guard_name' => 'web',
            ]);

            $role->syncPermissions($permissions);
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    /**
     * @return array<int, string>
     */
    private function permissions(): array
    {
        return [
            'organizations.view',
            'organizations.create',
            'organizations.update',
            'organizations.delete',
            'workspace_settings.view',
            'workspace_settings.update',
            'organization_locations.view',
            'organization_locations.create',
            'organization_locations.update',
            'organization_locations.delete',
            'users.view',
            'users.create',
            'users.update',
            'users.delete',
            'roles.view',
            'roles.create',
            'roles.update',
            'roles.delete',
            'permissions.view',
            'departments.view',
            'departments.create',
            'departments.update',
            'departments.delete',
            'units.view',
            'units.create',
            'units.update',
            'units.delete',
            'designations.view',
            'designations.create',
            'designations.update',
            'designations.delete',
            'grade_levels.view',
            'grade_levels.create',
            'grade_levels.update',
            'grade_levels.delete',
            'employment_types.view',
            'employment_types.create',
            'employment_types.update',
            'employment_types.delete',
            'employees.view',
            'employees.create',
            'employees.update',
            'employees.delete',
            'employee_documents.view',
            'employee_documents.create',
            'employee_documents.update',
            'employee_documents.delete',
            'leave_requests.view',
            'leave_requests.create',
            'leave_requests.approve',
            'leave_requests.cancel',
            'attendance.view',
            'attendance.create',
            'attendance.update',
            'reports.view',
            'audit_logs.view',
            'payroll.view',
            'recruitment.view',
            'performance.view',
            'learning.view',
            'service_desk.view',
            'assets.view',
            'financial_admin.view',
            'ai_assistant.use',
        ];
    }

    /**
     * @return array<string, array<int, string>>
     */
    private function rolePermissions(): array
    {
        $all = $this->permissions();

        return [
            'Super Admin' => $all,
            'Organization Admin' => $all,
            'HR Director' => [
                'organizations.view',
                'workspace_settings.view',
                'workspace_settings.update',
                'organization_locations.view',
                'organization_locations.create',
                'organization_locations.update',
                'users.view',
                'users.create',
                'users.update',
                'roles.view',
                'departments.view',
                'departments.create',
                'departments.update',
                'units.view',
                'units.create',
                'units.update',
                'designations.view',
                'designations.create',
                'designations.update',
                'grade_levels.view',
                'grade_levels.create',
                'grade_levels.update',
                'employment_types.view',
                'employment_types.create',
                'employment_types.update',
                'employees.view',
                'employees.create',
                'employees.update',
                'employee_documents.view',
                'employee_documents.create',
                'employee_documents.update',
                'leave_requests.view',
                'leave_requests.approve',
                'attendance.view',
                'attendance.create',
                'attendance.update',
                'reports.view',
                'audit_logs.view',
            ],
            'HR Officer' => [
                'organizations.view',
                'workspace_settings.view',
                'organization_locations.view',
                'users.view',
                'departments.view',
                'units.view',
                'designations.view',
                'grade_levels.view',
                'employment_types.view',
                'employees.view',
                'employees.create',
                'employees.update',
                'employee_documents.view',
                'employee_documents.create',
                'employee_documents.update',
                'leave_requests.view',
                'attendance.view',
                'attendance.create',
                'attendance.update',
                'reports.view',
            ],
            'Compliance Officer' => [
                'organizations.view',
                'workspace_settings.view',
                'organization_locations.view',
                'users.view',
                'departments.view',
                'units.view',
                'designations.view',
                'grade_levels.view',
                'employment_types.view',
                'employees.view',
                'employee_documents.view',
                'employee_documents.create',
                'employee_documents.update',
                'leave_requests.view',
                'attendance.view',
                'reports.view',
                'audit_logs.view',
            ],
            'ICT Admin' => [
                'organizations.view',
                'workspace_settings.view',
                'users.view',
                'users.create',
                'users.update',
                'roles.view',
                'permissions.view',
                'audit_logs.view',
            ],
            'Department Head' => [
                'organizations.view',
                'workspace_settings.view',
                'organization_locations.view',
                'departments.view',
                'units.view',
                'designations.view',
                'grade_levels.view',
                'employment_types.view',
                'employees.view',
                'employee_documents.view',
                'leave_requests.view',
                'leave_requests.approve',
                'attendance.view',
                'reports.view',
            ],
            'Supervisor' => [
                'organizations.view',
                'workspace_settings.view',
                'organization_locations.view',
                'departments.view',
                'units.view',
                'designations.view',
                'grade_levels.view',
                'employment_types.view',
                'employees.view',
                'leave_requests.view',
                'leave_requests.approve',
                'attendance.view',
            ],
            'Employee' => [
                'organizations.view',
                'workspace_settings.view',
                'leave_requests.create',
                'leave_requests.cancel',
            ],
        ];
    }
}
