<?php

namespace App\Services;

use App\Models\ApprovalWorkflow;
use App\Models\AttendanceSetting;
use App\Models\Department;
use App\Models\Designation;
use App\Models\DocumentRequirement;
use App\Models\DocumentType;
use App\Models\Employee;
use App\Models\EmployeeCustomField;
use App\Models\EmploymentType;
use App\Models\GradeLevel;
use App\Models\LeaveHoliday;
use App\Models\LeavePeriod;
use App\Models\LeaveType;
use App\Models\LeaveWorkDay;
use App\Models\Organization;
use App\Models\OrganizationLocation;
use App\Models\Unit;
use App\Models\User;
use App\Models\WorkShift;
use Illuminate\Support\Collection;

class SetupChecklistService
{
    public function __construct(private readonly WorkspaceSettingsService $workspaceSettings)
    {
    }

    /**
     * @return array<string, mixed>
     */
    public function forUser(User $user): array
    {
        $organization = $user->organization()->firstOrFail();
        $moduleKeys = $this->activeModuleKeys($organization);
        $items = collect($this->items($organization, $moduleKeys))->values();
        $required = $items->where('required', true);
        $recommended = $items->where('required', false);
        $requiredCompleted = $required->where('completed', true)->count();
        $recommendedCompleted = $recommended->where('completed', true)->count();

        return [
            'organization' => [
                'id' => $organization->id,
                'name' => $organization->name,
                'code' => $organization->code,
                'status' => $organization->status,
            ],
            'status' => $this->status($requiredCompleted, $required->count()),
            'summary' => [
                'required_completed' => $requiredCompleted,
                'required_total' => $required->count(),
                'required_percentage' => $this->percentage($requiredCompleted, $required->count()),
                'recommended_completed' => $recommendedCompleted,
                'recommended_total' => $recommended->count(),
                'recommended_percentage' => $this->percentage($recommendedCompleted, $recommended->count()),
                'total_completed' => $items->where('completed', true)->count(),
                'total_items' => $items->count(),
            ],
            'modules' => $moduleKeys->values()->all(),
            'sections' => $items
                ->groupBy('section')
                ->map(fn (Collection $sectionItems, string $section) => [
                    'key' => $section,
                    'label' => $this->sectionLabel($section),
                    'completed' => $sectionItems->where('completed', true)->count(),
                    'total' => $sectionItems->count(),
                    'items' => $sectionItems->values()->all(),
                ])
                ->values()
                ->all(),
            'next_actions' => $items
                ->where('completed', false)
                ->sortBy([
                    ['required', 'desc'],
                    ['priority', 'asc'],
                ])
                ->take(5)
                ->values()
                ->all(),
        ];
    }

    /**
     * @param Collection<int, string> $moduleKeys
     * @return array<int, array<string, mixed>>
     */
    private function items(Organization $organization, Collection $moduleKeys): array
    {
        $workspace = $this->workspaceSettings->forOrganization($organization);

        $items = [
            $this->item(
                'organization_profile',
                'core',
                'Complete organization profile',
                'Add the company identity, contact details, address, and country.',
                filled($organization->name) && filled($organization->code) && filled($organization->country),
                'Open organization settings',
                '/workspace/settings',
                true,
                10,
                ['missing_fields' => $this->missingOrganizationFields($organization)]
            ),
            $this->item(
                'workspace_localization',
                'core',
                'Confirm localization',
                'Set timezone, date format, currency, and country for the workspace.',
                filled(data_get($workspace, 'localization.timezone')) && filled(data_get($workspace, 'localization.currency')) && filled(data_get($workspace, 'localization.country')),
                'Open workspace settings',
                '/workspace/settings',
                true,
                20
            ),
            $this->item(
                'workspace_branding',
                'core',
                'Customize workspace branding',
                'Add welcome text, colors, typography, support email, and optional brand assets.',
                filled(data_get($workspace, 'identity.support_email')) && filled(data_get($workspace, 'theme.primary_color')) && filled(data_get($workspace, 'theme.font_family')),
                'Open workspace settings',
                '/workspace/settings',
                false,
                30
            ),
            $this->countItem($organization, OrganizationLocation::class, 'locations', 'structure', 'Add locations', 'Create the head office and any operating locations.', 'Open locations', '/setup/locations', true, 40),
            $this->countItem($organization, Department::class, 'departments', 'structure', 'Add departments', 'Define the departments that own employee records and reporting lines.', 'Open departments', '/setup/departments', true, 50),
            $this->countItem($organization, Unit::class, 'units', 'structure', 'Add units', 'Break departments into units or teams where needed.', 'Open units', '/setup/units', false, 60),
            $this->countItem($organization, Designation::class, 'designations', 'structure', 'Add designations', 'Define job titles and designations for employees.', 'Open designations', '/setup/designations', true, 70),
            $this->countItem($organization, GradeLevel::class, 'grade_levels', 'structure', 'Add grade levels', 'Configure seniority, grade, or band levels.', 'Open grade levels', '/setup/grade-levels', false, 80),
            $this->countItem($organization, EmploymentType::class, 'employment_types', 'structure', 'Add employment types', 'Create permanent, contract, intern, or other employment categories.', 'Open employment types', '/setup/employment-types', true, 90),
            $this->countItem($organization, Employee::class, 'employees', 'employees', 'Add employee records', 'Create or import the first employee records.', 'Open employees', '/employees', true, 100),
            $this->countItem($organization, EmployeeCustomField::class, 'employee_custom_fields', 'employees', 'Configure custom employee fields', 'Add organization-specific employee fields where needed.', 'Open custom fields', '/employee-profile/custom-fields', false, 110),
            $this->countItem($organization, User::class, 'users', 'access', 'Confirm user access', 'Ensure admins, HR officers, managers, and employees have user accounts.', 'Open users and roles', '/users', true, 120),
        ];

        if ($moduleKeys->contains('documents')) {
            $items[] = $this->countItem($organization, DocumentType::class, 'document_types', 'documents', 'Add document types', 'Define documents employees can submit or HR can track.', 'Open document types', '/documents/types', true, 130);
            $items[] = $this->countItem($organization, DocumentRequirement::class, 'document_requirements', 'documents', 'Add document requirements', 'Define required documents and compliance rules.', 'Open document requirements', '/documents/requirements', true, 140);
        }

        if ($moduleKeys->intersect(['documents', 'leave', 'attendance'])->isNotEmpty()) {
            $items[] = $this->countItem($organization, ApprovalWorkflow::class, 'approval_workflows', 'approvals', 'Configure approval workflows', 'Confirm approval flows for documents, leave, and attendance corrections.', 'Open approval workflows', '/approval-workflows', true, 150);
        }

        if ($moduleKeys->contains('leave')) {
            $items[] = $this->countItem($organization, LeaveType::class, 'leave_types', 'leave', 'Add leave types', 'Define annual, sick, compassionate, or other leave categories.', 'Open leave types', '/leave/types', true, 160);
            $items[] = $this->countItem($organization, LeavePeriod::class, 'leave_periods', 'leave', 'Add leave periods', 'Create active leave years or periods for balances.', 'Open leave periods', '/leave/periods', true, 170);
            $items[] = $this->countItem($organization, LeaveWorkDay::class, 'leave_work_days', 'leave', 'Configure work week', 'Set which weekdays count as working days for leave calculations.', 'Open leave settings', '/leave/work-days', true, 180);
            $items[] = $this->countItem($organization, LeaveHoliday::class, 'leave_holidays', 'leave', 'Add holidays', 'Add public holidays and organization closure days.', 'Open holidays', '/leave/holidays', false, 190);
        }

        if ($moduleKeys->contains('attendance')) {
            $items[] = $this->item(
                'attendance_settings',
                'attendance',
                'Confirm attendance settings',
                'Set attendance timezone, allowed sources, correction policy, and employee clock-in access.',
                AttendanceSetting::query()->where('organization_id', $organization->id)->exists(),
                'Open attendance settings',
                '/attendance/settings',
                true,
                200
            );
            $items[] = $this->countItem($organization, WorkShift::class, 'work_shifts', 'attendance', 'Add work shifts', 'Create default and alternate work shifts for attendance calculations.', 'Open work shifts', '/attendance/shifts', true, 210);
        }

        if ($moduleKeys->contains('reports')) {
            $items[] = $this->item(
                'reports_available',
                'reports',
                'Confirm reports access',
                'Make sure admins and HR users can access operational reports and exports.',
                true,
                'Open reports',
                '/reports',
                false,
                220
            );
        }

        return $items;
    }

    /**
     * @return Collection<int, string>
     */
    private function activeModuleKeys(Organization $organization): Collection
    {
        return $organization->moduleSubscriptions()
            ->with('platformModule:id,key')
            ->whereIn('status', ['active', 'trial'])
            ->get()
            ->pluck('platformModule.key')
            ->filter()
            ->values();
    }

    /**
     * @param class-string $model
     * @return array<string, mixed>
     */
    private function countItem(Organization $organization, string $model, string $key, string $section, string $label, string $description, string $actionLabel, string $actionUrl, bool $required, int $priority): array
    {
        $count = $model::query()->where('organization_id', $organization->id)->count();

        return $this->item($key, $section, $label, $description, $count > 0, $actionLabel, $actionUrl, $required, $priority, [
            'count' => $count,
        ]);
    }

    /**
     * @param array<string, mixed> $meta
     * @return array<string, mixed>
     */
    private function item(string $key, string $section, string $label, string $description, bool $completed, string $actionLabel, string $actionUrl, bool $required, int $priority, array $meta = []): array
    {
        return [
            'key' => $key,
            'section' => $section,
            'label' => $label,
            'description' => $description,
            'completed' => $completed,
            'required' => $required,
            'priority' => $priority,
            'status' => $completed ? 'complete' : ($required ? 'required' : 'recommended'),
            'action' => [
                'label' => $actionLabel,
                'url' => $actionUrl,
            ],
            'meta' => $meta,
        ];
    }

    /**
     * @return array<int, string>
     */
    private function missingOrganizationFields(Organization $organization): array
    {
        return collect(['name', 'code', 'email', 'phone', 'address', 'city', 'state', 'country'])
            ->filter(fn (string $field) => blank($organization->{$field}))
            ->values()
            ->all();
    }

    private function status(int $completed, int $total): string
    {
        if ($total === 0 || $completed === 0) {
            return 'pending';
        }

        if ($completed < $total) {
            return 'in_progress';
        }

        return 'ready';
    }

    private function percentage(int $completed, int $total): int
    {
        if ($total === 0) {
            return 100;
        }

        return (int) round(($completed / $total) * 100);
    }

    private function sectionLabel(string $section): string
    {
        return [
            'core' => 'Core Workspace',
            'structure' => 'Organization Structure',
            'employees' => 'Employees',
            'access' => 'Access Control',
            'documents' => 'Documents and Compliance',
            'approvals' => 'Approvals',
            'leave' => 'Leave',
            'attendance' => 'Attendance',
            'reports' => 'Reports',
        ][$section] ?? str($section)->headline()->toString();
    }
}
