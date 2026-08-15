<?php

namespace App\Services;

use Illuminate\Support\Collection;

class TemplateRegistryService
{
    /**
     * @return Collection<int, array<string, mixed>>
     */
    public function availableFor(mixed $user): Collection
    {
        return collect($this->templates())
            ->filter(fn (array $template) => $this->canUse($user, $template))
            ->values();
    }

    /**
     * @return array<string, mixed>
     */
    public function findFor(mixed $user, string $key): array
    {
        $template = collect($this->templates())->firstWhere('key', $key);

        abort_unless($template, 404);
        abort_unless($this->canUse($user, $template), 403);

        return $template;
    }

    /**
     * @param array<string, mixed> $template
     * @return array<int, array<int, string>>
     */
    public function rows(array $template): array
    {
        return [
            $template['columns'],
            $template['sample'],
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function templates(): array
    {
        return [
            [
                'key' => 'attendance_import',
                'name' => 'Attendance Import',
                'module' => 'attendance',
                'description' => 'Bulk import attendance records by employee number and date.',
                'permission' => 'attendance.create',
                'filename' => 'attendance-import-template.csv',
                'columns' => ['employee_number', 'attendance_date', 'check_in_at', 'check_out_at', 'source', 'work_shift_code', 'status', 'notes'],
                'sample' => ['EMP-FIN-001', '2026-08-20', '2026-08-20 09:00:00', '2026-08-20 17:00:00', 'import', 'REGULAR', 'present', 'Imported from device file.'],
            ],
            [
                'key' => 'employee_import',
                'name' => 'Employee Import',
                'module' => 'employees',
                'description' => 'Bulk create employee records using organization structure codes.',
                'permission' => 'employees.create',
                'filename' => 'employee-import-template.csv',
                'columns' => ['employee_number', 'first_name', 'middle_name', 'last_name', 'work_email', 'phone', 'department_code', 'unit_code', 'designation_code', 'grade_level_code', 'employment_type_code', 'location_code', 'reporting_manager_number', 'start_date', 'send_invitation'],
                'sample' => ['EMP-1001', 'Ada', '', 'Lovelace', 'ada@example.test', '08012345678', 'FIN', 'FIN-PAY', 'OFF', 'GL05', 'PERM', 'HQ', 'EMP-HR-001', '2026-08-20', 'true'],
            ],
            [
                'key' => 'leave_entitlement_import',
                'name' => 'Leave Entitlement Import',
                'module' => 'leave',
                'description' => 'Bulk assign leave entitlements for a leave period.',
                'permission' => 'leave_requests.approve',
                'filename' => 'leave-entitlement-import-template.csv',
                'columns' => ['employee_number', 'leave_type_code', 'leave_period_name', 'days_allocated', 'notes'],
                'sample' => ['EMP-FIN-001', 'ANNUAL', '2026 Leave Year', '20', 'Annual entitlement.'],
            ],
            [
                'key' => 'document_requirement_import',
                'name' => 'Document Requirement Import',
                'module' => 'documents',
                'description' => 'Bulk create document requirements and optional scoping rules.',
                'permission' => 'employee_documents.create',
                'filename' => 'document-requirement-import-template.csv',
                'columns' => ['document_type_code', 'requirement_name', 'description', 'is_required', 'employee_upload_allowed', 'approval_required', 'reminder_days', 'department_code', 'designation_code', 'grade_level_code', 'employment_type_code', 'location_code', 'is_active'],
                'sample' => ['GOV-ID', 'Government ID for all employees', 'Every employee must provide a valid government-issued ID.', 'true', 'true', 'true', '45', '', '', '', '', '', 'true'],
            ],
        ];
    }

    /**
     * @param array<string, mixed> $template
     */
    private function canUse(mixed $user, array $template): bool
    {
        return $user?->can($template['permission']) === true;
    }
}
