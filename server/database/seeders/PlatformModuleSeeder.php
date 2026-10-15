<?php

namespace Database\Seeders;

use App\Models\Organization;
use App\Models\PlatformModule;
use Illuminate\Database\Seeder;

class PlatformModuleSeeder extends Seeder
{
    /**
     * Seed platform modules and demo organization subscriptions.
     */
    public function run(): void
    {
        foreach ($this->modules() as $module) {
            PlatformModule::query()->updateOrCreate(
                ['key' => $module['key']],
                $module
            );
        }

        $organization = Organization::query()->where('code', 'VALTIREO')->first();

        if (! $organization) {
            return;
        }

        foreach ($this->subscribedModuleKeys() as $moduleKey) {
            $module = PlatformModule::query()->where('key', $moduleKey)->firstOrFail();

            $organization->moduleSubscriptions()->updateOrCreate(
                ['platform_module_id' => $module->id],
                [
                    'status' => 'active',
                    'starts_at' => now(),
                    'expires_at' => null,
                    'settings' => [],
                ]
            );
        }
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function modules(): array
    {
        return [
            [
                'name' => 'Organization Setup',
                'key' => 'organization_setup',
                'description' => 'Organization profile, locations, and setup controls.',
                'category' => 'core',
                'required_permission' => 'organizations.view',
                'is_active' => true,
                'sort_order' => 10,
            ],
            [
                'name' => 'Users and Roles',
                'key' => 'users_roles',
                'description' => 'User accounts, roles, permissions, and access control.',
                'category' => 'core',
                'required_permission' => 'users.view',
                'is_active' => true,
                'sort_order' => 20,
            ],
            [
                'name' => 'Organization Structure',
                'key' => 'organization_structure',
                'description' => 'Departments, units, designations, grade levels, and employment types.',
                'category' => 'core',
                'required_permission' => 'departments.view',
                'is_active' => true,
                'sort_order' => 30,
            ],
            [
                'name' => 'Employees',
                'key' => 'employees',
                'description' => 'Employee records, profiles, and employment data.',
                'category' => 'hr',
                'required_permission' => 'employees.view',
                'is_active' => true,
                'sort_order' => 40,
            ],
            [
                'name' => 'Employee Self Service',
                'key' => 'employee_self_service',
                'description' => 'Employee profile, documents, requests, and self-service actions.',
                'category' => 'hr',
                'required_permission' => 'organizations.view',
                'is_active' => true,
                'sort_order' => 45,
            ],
            [
                'name' => 'Documents',
                'key' => 'documents',
                'description' => 'Document types, employee documents, approvals, and expiries.',
                'category' => 'hr',
                // No required_permission, matching attendance/assets/payroll/service_desk:
                // every route this module gates (store/download/view/acknowledge/signed-copy
                // in EmployeeDocumentController) already has its own self-service fallback
                // (upload/view/acknowledge your own document needs no special permission —
                // see SubmitEmployeeDocumentRequest::authorize() and
                // EmployeeDocumentController::authorizeDocumentAccess()), so gating the
                // module itself behind employee_documents.view silently hid the module
                // (and any mobile/web nav entry keyed off it) for every ordinary employee
                // even though they could already use every endpoint it covers.
                'required_permission' => null,
                'is_active' => true,
                'sort_order' => 50,
            ],
            [
                'name' => 'Leave',
                'key' => 'leave',
                'description' => 'Leave types, requests, approvals, and balances.',
                'category' => 'hr',
                'required_permission' => null,
                'is_active' => true,
                'sort_order' => 60,
            ],
            [
                'name' => 'Attendance',
                'key' => 'attendance',
                'description' => 'Attendance records, manual entries, and imports.',
                'category' => 'hr',
                // Matches 'leave' and 'service_desk' below: these three are the
                // self-service modules every employee gets by default. The
                // AttendanceRecordController already allows attendance.create
                // (which the Employee role has) as an alternative to
                // attendance.view, so this module-level gate must not be
                // stricter than the endpoints it's supposed to represent.
                'required_permission' => null,
                'is_active' => true,
                'sort_order' => 70,
            ],
            [
                'name' => 'Deployment',
                'key' => 'deployment',
                'description' => 'Staff deployment, locations, and assignment tracking.',
                'category' => 'hr',
                'required_permission' => 'employees.view',
                'is_active' => true,
                'sort_order' => 80,
            ],
            [
                'name' => 'Reports',
                'key' => 'reports',
                'description' => 'Operational reports, HR summaries, and management views.',
                'category' => 'analytics',
                'required_permission' => 'reports.view',
                'is_active' => true,
                'sort_order' => 90,
            ],
            [
                'name' => 'Audit Logs',
                'key' => 'audit_logs',
                'description' => 'Audit trail and sensitive activity review.',
                'category' => 'governance',
                'required_permission' => 'audit_logs.view',
                'is_active' => true,
                'sort_order' => 100,
            ],
            [
                'name' => 'Payroll',
                'key' => 'payroll',
                'description' => 'Payroll preparation, salary records, allowances, and deductions.',
                'category' => 'finance',
                // EmployeePayrollController's self-service endpoints already gate on
                // payroll.payslips.view_own / payroll.compensation.view_own, which the
                // Employee role holds — this module-level gate must not be stricter
                // than that. Admin payroll nav/pages carry their own 'payroll.view'
                // permission check independently, so this stays safe to loosen.
                'required_permission' => null,
                'is_active' => true,
                'sort_order' => 200,
            ],
            [
                'name' => 'Recruitment',
                'key' => 'recruitment',
                'description' => 'Recruitment, applicants, interviews, and hiring workflows.',
                'category' => 'growth',
                'required_permission' => 'recruitment.view',
                'is_active' => true,
                'sort_order' => 210,
            ],
            [
                'name' => 'Performance',
                'key' => 'performance',
                'description' => 'Performance appraisal, goals, reviews, and summaries.',
                'category' => 'growth',
                'required_permission' => 'performance.view',
                'is_active' => true,
                'sort_order' => 220,
            ],
            [
                'name' => 'Learning',
                'key' => 'learning',
                'description' => 'Training, certifications, courses, and learning records.',
                'category' => 'growth',
                'required_permission' => 'learning.view',
                'is_active' => true,
                'sort_order' => 230,
            ],
            [
                'name' => 'Service Desk',
                'key' => 'service_desk',
                'description' => 'Internal requests, tickets, support queues, and SLAs.',
                'category' => 'operations',
                'required_permission' => null,
                'is_active' => true,
                'sort_order' => 240,
            ],
            [
                'name' => 'Assets',
                'key' => 'assets',
                'description' => 'Staff assets, assignments, returns, and asset records.',
                'category' => 'admin',
                // AssetController's index already scopes to the caller's own assigned
                // assets when they lack assets.view, rather than denying outright — so
                // self-service "my assets" needs no permission at all. The admin Assets
                // settings nav entry carries its own 'assets.view' permission check
                // independently, so loosening this module gate is safe.
                'required_permission' => null,
                'is_active' => true,
                'sort_order' => 250,
            ],
            [
                'name' => 'Financial Admin',
                'key' => 'financial_admin',
                'description' => 'Claims, reimbursements, loans, imprest, budgets, and approvals.',
                'category' => 'finance',
                'required_permission' => 'financial_admin.view',
                'is_active' => true,
                'sort_order' => 260,
            ],
            [
                'name' => 'AI Assistant',
                'key' => 'ai_assistant',
                'description' => 'AI summaries, policy help, report generation, and anomaly checks.',
                'category' => 'intelligence',
                'required_permission' => 'ai_assistant.use',
                'is_active' => true,
                'sort_order' => 300,
            ],
        ];
    }

    /**
     * @return array<int, string>
     */
    private function subscribedModuleKeys(): array
    {
        return [
            'organization_setup',
            'users_roles',
            'organization_structure',
            'employees',
            'employee_self_service',
            'documents',
            'leave',
            'attendance',
            'payroll',
            'deployment',
            'reports',
            'audit_logs',
            'service_desk',
            'assets',
        ];
    }
}
