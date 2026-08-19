<?php

namespace App\Services;

use App\Models\Organization;
use App\Models\Role;
use Illuminate\Support\Collection;

/**
 * Seeds every new organization's starter role set — the same 8 roles and
 * permission sets that used to be global, now created as this org's own
 * rows. Fully idempotent (firstOrCreate keyed on the internal `key`, never
 * on `name`) so re-running it after an org has renamed one of these roles
 * never creates a duplicate. Once seeded, an organization is free to
 * rename, re-permission, or delete any of these roles — nothing here (or
 * anywhere else) treats them as special beyond bootstrapping.
 */
class DefaultRoleSeedingService
{
    /**
     * @return Collection<string, Role> keyed by the internal `key`
     */
    public function seedForOrganization(Organization $organization): Collection
    {
        $roles = new Collection();

        foreach ($this->definitions() as $key => $definition) {
            $role = $organization->roles()->firstOrCreate(
                ['key' => $key, 'guard_name' => 'web'],
                [
                    'name' => $definition['name'],
                    'description' => $definition['description'],
                ]
            );

            $role->syncPermissions($definition['permissions']);
            $roles->put($key, $role);
        }

        return $roles;
    }

    /**
     * @return array<string, array{name: string, description: string, permissions: array<int, string>}>
     */
    private function definitions(): array
    {
        $all = app(\Database\Seeders\RolePermissionSeeder::class)->permissions();

        return [
            'organization_admin' => [
                'name' => 'Organization Admin',
                'description' => 'Full access to every module and setting in this organization.',
                'permissions' => $all,
            ],
            'hr_director' => [
                'name' => 'HR Director',
                'description' => 'Leads HR strategy — full people operations, approvals, and workspace configuration.',
                'permissions' => [
                    'organizations.view', 'workspace_settings.view', 'workspace_settings.update',
                    'organization_locations.view', 'organization_locations.create', 'organization_locations.update',
                    'users.view', 'users.create', 'users.update', 'roles.view',
                    'departments.view', 'departments.create', 'departments.update',
                    'units.view', 'units.create', 'units.update',
                    'designations.view', 'designations.create', 'designations.update',
                    'grade_levels.view', 'grade_levels.create', 'grade_levels.update',
                    'employment_types.view', 'employment_types.create', 'employment_types.update',
                    'employees.view', 'employees.create', 'employees.update',
                    'employees.view_team', 'employees.view_department', 'employees.assign_role',
                    'employee_documents.view', 'employee_documents.create', 'employee_documents.update',
                    'approval_workflows.view', 'approval_workflows.create', 'approval_workflows.update',
                    'approvals.view', 'approvals.action',
                    'leave_requests.view', 'leave_requests.create', 'leave_requests.approve',
                    'attendance.view', 'attendance.create', 'attendance.update', 'attendance.correct',
                    'reports.view', 'audit_logs.view',
                ],
            ],
            'hr_officer' => [
                'name' => 'HR Officer',
                'description' => 'Handles day-to-day HR administration.',
                'permissions' => [
                    'organizations.view', 'workspace_settings.view', 'organization_locations.view',
                    'users.view', 'departments.view', 'units.view', 'designations.view',
                    'grade_levels.view', 'employment_types.view',
                    'employees.view', 'employees.create', 'employees.update', 'employees.view_team',
                    'employee_documents.view', 'employee_documents.create', 'employee_documents.update',
                    'approval_workflows.view', 'approvals.view', 'approvals.action',
                    'leave_requests.view', 'leave_requests.create',
                    'attendance.view', 'attendance.create', 'attendance.update', 'attendance.correct',
                    'reports.view',
                ],
            ],
            'compliance_officer' => [
                'name' => 'Compliance Officer',
                'description' => 'Monitors compliance, audit readiness, and policy controls.',
                'permissions' => [
                    'organizations.view', 'workspace_settings.view', 'organization_locations.view',
                    'users.view', 'departments.view', 'units.view', 'designations.view',
                    'grade_levels.view', 'employment_types.view',
                    'employees.view', 'employees.view_team',
                    'employee_documents.view', 'employee_documents.create', 'employee_documents.update',
                    'approval_workflows.view', 'approvals.view', 'approvals.action',
                    'leave_requests.view', 'attendance.view', 'attendance.correct',
                    'reports.view', 'audit_logs.view',
                ],
            ],
            'ict_admin' => [
                'name' => 'ICT Admin',
                'description' => 'Manages technology support, systems, and user access.',
                'permissions' => [
                    'organizations.view', 'workspace_settings.view',
                    'users.view', 'users.create', 'users.update',
                    'roles.view', 'permissions.view', 'audit_logs.view',
                ],
            ],
            'department_head' => [
                'name' => 'Department Head',
                'description' => 'Leads a department — approvals and visibility across the whole department.',
                'permissions' => [
                    'organizations.view', 'workspace_settings.view', 'organization_locations.view',
                    'departments.view', 'units.view', 'designations.view', 'grade_levels.view', 'employment_types.view',
                    'employees.view', 'employees.view_team', 'employees.view_department',
                    'employee_documents.view',
                    'approvals.view', 'approvals.action',
                    'leave_requests.view', 'leave_requests.approve',
                    'attendance.view', 'attendance.correct',
                    'reports.view',
                ],
            ],
            'supervisor' => [
                'name' => 'Supervisor',
                'description' => 'Supervises direct reports and their approvals.',
                'permissions' => [
                    'organizations.view', 'workspace_settings.view', 'organization_locations.view',
                    'departments.view', 'units.view', 'designations.view', 'grade_levels.view', 'employment_types.view',
                    'employees.view', 'employees.view_team',
                    'approvals.view', 'approvals.action',
                    'leave_requests.view', 'leave_requests.approve',
                    'attendance.view', 'attendance.correct',
                ],
            ],
            'employee' => [
                'name' => 'Employee',
                'description' => 'Standard self-service access — the default role for a new hire.',
                'permissions' => [
                    'organizations.view', 'workspace_settings.view',
                    'leave_requests.create', 'leave_requests.cancel',
                    'attendance.create', 'attendance.correct',
                ],
            ],
        ];
    }
}
