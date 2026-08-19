<?php

namespace Database\Seeders;

use App\Models\Permission;
use Illuminate\Database\Seeder;
use Spatie\Permission\PermissionRegistrar;

/**
 * Seeds only the global permission catalog. Roles are organization-owned —
 * see DefaultRoleSeedingService, called once per organization (at
 * provisioning, and by DatabaseSeeder/demo seeders), not from here.
 */
class RolePermissionSeeder extends Seeder
{
    public function run(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        foreach ($this->permissions() as $permission) {
            Permission::query()->firstOrCreate([
                'name' => $permission,
                'guard_name' => 'web',
            ]);
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    /**
     * @return array<int, string>
     */
    public function permissions(): array
    {
        return [
            'organizations.view',
            'organizations.create',
            'organizations.update',
            'organizations.delete',
            // Blanket "this is the org's top authority" bypass — used in a
            // handful of places (approval routing, module access) instead of
            // a hardcoded role-name check. Only the seeded Organization Admin
            // role carries this by default; an org is free to grant it to
            // any custom role it creates.
            'organizations.administer',
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
            'employees.view_team',
            'employees.view_department',
            'employees.assign_role',
            'employee_documents.view',
            'employee_documents.create',
            'employee_documents.update',
            'employee_documents.delete',
            'approval_workflows.view',
            'approval_workflows.create',
            'approval_workflows.update',
            'approval_workflows.delete',
            'approvals.view',
            'approvals.action',
            'leave_requests.view',
            'leave_requests.create',
            'leave_requests.approve',
            'leave_requests.cancel',
            'attendance.view',
            'attendance.create',
            'attendance.update',
            'attendance.correct',
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
}
