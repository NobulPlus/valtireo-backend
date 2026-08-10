<?php

namespace App\Services;

use App\Models\Department;
use App\Models\Designation;
use App\Models\Employee;
use App\Models\EmployeeInvitation;
use App\Models\EmployeeProfile;
use App\Models\AttendanceCorrectionRequest;
use App\Models\AttendanceRecord;
use App\Models\EmploymentType;
use App\Models\GradeLevel;
use App\Models\LeaveEntitlement;
use App\Models\LeaveRequest;
use App\Models\Organization;
use App\Models\OrganizationLocation;
use App\Models\PlatformModule;
use App\Models\Unit;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\HttpException;

class DashboardService
{
    /**
     * @return array<string, mixed>
     */
    public function organization(User $user, Request $request): array
    {
        $organization = $user->organization;
        $filters = $this->filters($request);
        $employeeQuery = $this->employeeQuery($organization, $filters);

        return [
            'filters' => $filters,
            'employees' => [
                'total' => (clone $employeeQuery)->count(),
                'active' => (clone $employeeQuery)->where('status', 'active')->count(),
                'draft' => (clone $employeeQuery)->where('status', 'draft')->count(),
                'invited' => (clone $employeeQuery)->where('status', 'invited')->count(),
                'onboarding' => (clone $employeeQuery)->where('status', 'onboarding')->count(),
                'suspended' => (clone $employeeQuery)->where('status', 'suspended')->count(),
                'exited' => (clone $employeeQuery)->where('status', 'exited')->count(),
            ],
            'onboarding' => $this->onboardingMetrics($organization, $filters),
            'structure' => $this->structureMetrics($organization),
            'modules' => $this->moduleMetrics($organization),
            'breakdowns' => [
                'by_department' => $this->breakdown($organization, $filters, Department::class, 'department_id'),
                'by_location' => $this->breakdown($organization, $filters, OrganizationLocation::class, 'organization_location_id'),
                'by_employment_type' => $this->breakdown($organization, $filters, EmploymentType::class, 'employment_type_id'),
                'by_designation' => $this->breakdown($organization, $filters, Designation::class, 'designation_id'),
                'by_status' => $this->statusBreakdown($organization, $filters),
            ],
            'recent' => [
                'employees' => $this->recentEmployees($organization, $filters),
                'invitations' => $this->recentInvitations($organization, $filters),
            ],
            'setup_completion' => $this->setupCompletion($organization),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function manager(User $user, Request $request): array
    {
        $organization = $user->organization;
        $employee = $user->employee()
            ->with(['department', 'unit', 'designation', 'location'])
            ->first();
        $filters = $this->filters($request);
        $scope = $this->managerScope($user, $employee, $request);

        $employeeQuery = $this->employeeQuery($organization, $filters);

        if ($scope['type'] === 'department') {
            $employeeQuery->where('department_id', $scope['department']['id']);
        }

        if ($scope['type'] === 'direct_reports') {
            $employeeQuery->where('reporting_manager_id', $employee->id);
        }

        $employeeIds = (clone $employeeQuery)->pluck('id');

        return [
            'scope' => $scope,
            'filters' => $filters,
            'employees' => $this->employeeCounts($employeeQuery),
            'team_health' => [
                'profiles_pending' => EmployeeProfile::query()->whereIn('employee_id', $employeeIds)->where('completion_status', 'pending')->count(),
                'profiles_submitted' => EmployeeProfile::query()->whereIn('employee_id', $employeeIds)->where('completion_status', 'submitted')->count(),
                'profiles_approved' => EmployeeProfile::query()->whereIn('employee_id', $employeeIds)->where('completion_status', 'approved')->count(),
                'incomplete_profiles' => Employee::query()->whereIn('id', $employeeIds)->whereDoesntHave('profile')->count(),
            ],
            'composition' => [
                'by_designation' => $this->scopedBreakdown($employeeQuery, Designation::class, 'designation_id'),
                'by_employment_type' => $this->scopedBreakdown($employeeQuery, EmploymentType::class, 'employment_type_id'),
                'by_location' => $this->scopedBreakdown($employeeQuery, OrganizationLocation::class, 'organization_location_id'),
                'by_status' => $this->scopedStatusBreakdown($employeeQuery),
            ],
            'recent' => [
                'new_joiners' => (clone $employeeQuery)
                    ->with(['department:id,code,name', 'location:id,code,name'])
                    ->orderByDesc('start_date')
                    ->limit($filters['recent_limit'])
                    ->get()
                    ->map(fn (Employee $employee) => $this->employeeSummary($employee))
                    ->all(),
                'profile_updates' => EmployeeProfile::query()
                    ->with('employee.department:id,code,name', 'employee.location:id,code,name')
                    ->whereIn('employee_id', $employeeIds)
                    ->latest('updated_at')
                    ->limit($filters['recent_limit'])
                    ->get()
                    ->map(fn (EmployeeProfile $profile) => [
                        'id' => $profile->id,
                        'completion_status' => $profile->completion_status,
                        'updated_at' => $profile->updated_at,
                        'employee' => $profile->employee ? $this->employeeSummary($profile->employee) : null,
                    ])
                    ->all(),
            ],
            'people' => [
                'members' => (clone $employeeQuery)
                    ->with(['department:id,code,name', 'location:id,code,name'])
                    ->orderBy('first_name')
                    ->limit($filters['recent_limit'])
                    ->get()
                    ->map(fn (Employee $employee) => $this->employeeSummary($employee))
                    ->all(),
                'direct_reports' => $employee ? Employee::query()
                    ->with(['department:id,code,name', 'location:id,code,name'])
                    ->where('organization_id', $organization->id)
                    ->where('reporting_manager_id', $employee->id)
                    ->orderBy('first_name')
                    ->limit($filters['recent_limit'])
                    ->get()
                    ->map(fn (Employee $employee) => $this->employeeSummary($employee))
                    ->all() : [],
            ],
            'leave' => $this->leaveMetricsForEmployees($employeeIds),
            'attendance' => $this->attendanceMetricsForEmployees($employeeIds),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function me(User $user): array
    {
        $employee = $user->employee()
            ->with([
                'organization',
                'department',
                'unit',
                'designation',
                'gradeLevel',
                'employmentType',
                'location',
                'reportingManager',
                'profile',
            ])
            ->first();

        return [
            'employee' => $employee ? $this->employeePayload($employee) : null,
            'organization' => $user->organization ? [
                'id' => $user->organization->id,
                'name' => $user->organization->name,
                'code' => $user->organization->code,
                'status' => $user->organization->status,
            ] : null,
            'work' => $employee ? [
                'department' => $this->lookupPayload($employee->department),
                'unit' => $this->lookupPayload($employee->unit),
                'designation' => $this->lookupPayload($employee->designation),
                'grade_level' => $this->lookupPayload($employee->gradeLevel),
                'employment_type' => $this->lookupPayload($employee->employmentType),
                'location' => $this->lookupPayload($employee->location),
                'reporting_manager' => $employee->reportingManager ? $this->employeeSummary($employee->reportingManager) : null,
            ] : null,
            'profile' => $employee?->profile ? [
                'id' => $employee->profile->id,
                'completion_status' => $employee->profile->completion_status,
                'updated_at' => $employee->profile->updated_at,
            ] : null,
            'pending_actions' => $employee ? $this->pendingActions($employee) : [],
            'leave' => $employee ? $this->leaveSummaryForEmployee($employee) : null,
            'attendance' => $employee ? $this->attendanceSummaryForEmployee($employee) : null,
            'modules' => app(ModuleEntitlementService::class)->forUser($user),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function filters(Request $request): array
    {
        $sortBy = $request->string('sort_by', 'created_at')->toString();
        $sortDirection = strtolower($request->string('sort_direction', 'desc')->toString()) === 'asc' ? 'asc' : 'desc';
        $dateColumn = $request->string('date_column', 'created_at')->toString();

        return [
            'date_from' => $request->date('date_from')?->toDateString(),
            'date_to' => $request->date('date_to')?->toDateString(),
            'date_column' => in_array($dateColumn, $this->dateColumns(), true) ? $dateColumn : 'created_at',
            'department_id' => $request->integer('department_id') ?: null,
            'unit_id' => $request->integer('unit_id') ?: null,
            'designation_id' => $request->integer('designation_id') ?: null,
            'grade_level_id' => $request->integer('grade_level_id') ?: null,
            'employment_type_id' => $request->integer('employment_type_id') ?: null,
            'organization_location_id' => $request->integer('organization_location_id') ?: null,
            'status' => $request->string('status')->toString() ?: null,
            'search' => $request->string('search')->toString() ?: null,
            'sort_by' => in_array($sortBy, $this->sortColumns(), true) ? $sortBy : 'created_at',
            'sort_direction' => $sortDirection,
            'recent_limit' => min(max($request->integer('recent_limit', 5), 1), 25),
        ];
    }

    /**
     * @param array<string, mixed> $filters
     *
     * @return Builder<Employee>
     */
    private function employeeQuery(Organization $organization, array $filters): Builder
    {
        return Employee::query()
            ->where('organization_id', $organization->id)
            ->when($filters['department_id'], fn (Builder $query, int $id) => $query->where('department_id', $id))
            ->when($filters['unit_id'], fn (Builder $query, int $id) => $query->where('unit_id', $id))
            ->when($filters['designation_id'], fn (Builder $query, int $id) => $query->where('designation_id', $id))
            ->when($filters['grade_level_id'], fn (Builder $query, int $id) => $query->where('grade_level_id', $id))
            ->when($filters['employment_type_id'], fn (Builder $query, int $id) => $query->where('employment_type_id', $id))
            ->when($filters['organization_location_id'], fn (Builder $query, int $id) => $query->where('organization_location_id', $id))
            ->when($filters['status'], fn (Builder $query, string $status) => $query->where('status', $status))
            ->when($filters['search'], function (Builder $query, string $search): void {
                $query->where(function (Builder $query) use ($search): void {
                    $query
                        ->where('employee_number', 'like', "%{$search}%")
                        ->orWhere('first_name', 'like', "%{$search}%")
                        ->orWhere('last_name', 'like', "%{$search}%")
                        ->orWhere('work_email', 'like', "%{$search}%");
                });
            })
            ->when($filters['date_from'], fn (Builder $query, string $date) => $query->whereDate($filters['date_column'], '>=', $date))
            ->when($filters['date_to'], fn (Builder $query, string $date) => $query->whereDate($filters['date_column'], '<=', $date));
    }

    /**
     * @param array<string, mixed> $filters
     *
     * @return array<string, int>
     */
    private function onboardingMetrics(Organization $organization, array $filters): array
    {
        $employeeIds = $this->employeeQuery($organization, $filters)->pluck('id');

        return [
            'pending_profiles' => EmployeeProfile::query()->whereIn('employee_id', $employeeIds)->where('completion_status', 'pending')->count(),
            'submitted_profiles' => EmployeeProfile::query()->whereIn('employee_id', $employeeIds)->where('completion_status', 'submitted')->count(),
            'approved_profiles' => EmployeeProfile::query()->whereIn('employee_id', $employeeIds)->where('completion_status', 'approved')->count(),
            'pending_invitations' => EmployeeInvitation::query()->where('organization_id', $organization->id)->where('status', 'pending')->count(),
            'accepted_invitations' => EmployeeInvitation::query()->where('organization_id', $organization->id)->where('status', 'accepted')->count(),
            'expired_invitations' => EmployeeInvitation::query()
                ->where('organization_id', $organization->id)
                ->where(fn (Builder $query) => $query->where('status', 'expired')->orWhere(fn (Builder $query) => $query->where('status', 'pending')->where('expires_at', '<', now())))
                ->count(),
        ];
    }

    /**
     * @return array<string, int>
     */
    private function employeeCounts(Builder $employeeQuery): array
    {
        return [
            'total' => (clone $employeeQuery)->count(),
            'active' => (clone $employeeQuery)->where('status', 'active')->count(),
            'draft' => (clone $employeeQuery)->where('status', 'draft')->count(),
            'invited' => (clone $employeeQuery)->where('status', 'invited')->count(),
            'onboarding' => (clone $employeeQuery)->where('status', 'onboarding')->count(),
            'suspended' => (clone $employeeQuery)->where('status', 'suspended')->count(),
            'exited' => (clone $employeeQuery)->where('status', 'exited')->count(),
        ];
    }

    /**
     * @return array<string, int>
     */
    private function structureMetrics(Organization $organization): array
    {
        return [
            'departments' => Department::query()->where('organization_id', $organization->id)->count(),
            'units' => Unit::query()->where('organization_id', $organization->id)->count(),
            'locations' => OrganizationLocation::query()->where('organization_id', $organization->id)->count(),
            'designations' => Designation::query()->where('organization_id', $organization->id)->count(),
            'grade_levels' => GradeLevel::query()->where('organization_id', $organization->id)->count(),
            'employment_types' => EmploymentType::query()->where('organization_id', $organization->id)->count(),
        ];
    }

    /**
     * @return array<string, int>
     */
    private function moduleMetrics(Organization $organization): array
    {
        $available = PlatformModule::query()->where('is_active', true)->count();
        $active = $organization->moduleSubscriptions()->whereIn('status', ['active', 'trial'])->count();

        return [
            'available' => $available,
            'active' => $active,
            'locked' => max($available - $active, 0),
        ];
    }

    /**
     * @param class-string $model
     * @param array<string, mixed> $filters
     *
     * @return array<int, array<string, mixed>>
     */
    private function breakdown(Organization $organization, array $filters, string $model, string $foreignKey): array
    {
        $counts = $this->employeeQuery($organization, $filters)
            ->selectRaw("{$foreignKey}, count(*) as total")
            ->whereNotNull($foreignKey)
            ->groupBy($foreignKey)
            ->pluck('total', $foreignKey);

        return $model::query()
            ->where('organization_id', $organization->id)
            ->whereIn('id', $counts->keys())
            ->orderBy('name')
            ->get(['id', 'code', 'name'])
            ->map(fn ($item) => [
                'id' => $item->id,
                'code' => $item->code,
                'name' => $item->name,
                'total' => (int) $counts->get($item->id, 0),
            ])
            ->values()
            ->all();
    }

    /**
     * @param class-string $model
     *
     * @return array<int, array<string, mixed>>
     */
    private function scopedBreakdown(Builder $employeeQuery, string $model, string $foreignKey): array
    {
        $counts = (clone $employeeQuery)
            ->selectRaw("{$foreignKey}, count(*) as total")
            ->whereNotNull($foreignKey)
            ->groupBy($foreignKey)
            ->pluck('total', $foreignKey);

        return $model::query()
            ->whereIn('id', $counts->keys())
            ->orderBy('name')
            ->get(['id', 'code', 'name'])
            ->map(fn ($item) => [
                'id' => $item->id,
                'code' => $item->code,
                'name' => $item->name,
                'total' => (int) $counts->get($item->id, 0),
            ])
            ->values()
            ->all();
    }

    /**
     * @param array<string, mixed> $filters
     *
     * @return array<int, array<string, mixed>>
     */
    private function statusBreakdown(Organization $organization, array $filters): array
    {
        return $this->employeeQuery($organization, $filters)
            ->selectRaw('status, count(*) as total')
            ->groupBy('status')
            ->orderBy('status')
            ->get()
            ->map(fn (Employee $employee) => [
                'status' => $employee->status,
                'total' => (int) $employee->total,
            ])
            ->values()
            ->all();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function scopedStatusBreakdown(Builder $employeeQuery): array
    {
        return (clone $employeeQuery)
            ->selectRaw('status, count(*) as total')
            ->groupBy('status')
            ->orderBy('status')
            ->get()
            ->map(fn (Employee $employee) => [
                'status' => $employee->status,
                'total' => (int) $employee->total,
            ])
            ->values()
            ->all();
    }

    /**
     * @return array<string, mixed>
     */
    private function managerScope(User $user, ?Employee $employee, Request $request): array
    {
        if ($user->can('reports.view') && $request->integer('department_id')) {
            $department = Department::query()
                ->where('organization_id', $user->organization_id)
                ->where('id', $request->integer('department_id'))
                ->firstOrFail();

            return [
                'type' => 'department',
                'department' => $this->lookupPayload($department),
                'source' => 'requested_department',
            ];
        }

        if ($employee && $user->hasRole('Department Head') && $employee->department) {
            return [
                'type' => 'department',
                'department' => $this->lookupPayload($employee->department),
                'source' => 'department_head_assignment',
            ];
        }

        if ($employee && $user->hasAnyRole(['Supervisor', 'Department Head'])) {
            return [
                'type' => 'direct_reports',
                'manager' => $this->employeeSummary($employee),
                'source' => 'reporting_manager_assignment',
            ];
        }

        if ($employee && Employee::query()->where('reporting_manager_id', $employee->id)->exists()) {
            return [
                'type' => 'direct_reports',
                'manager' => $this->employeeSummary($employee),
                'source' => 'direct_reports_detected',
            ];
        }

        throw new HttpException(403, 'You do not have a department or team dashboard scope.');
    }

    /**
     * @param array<string, mixed> $filters
     *
     * @return array<int, array<string, mixed>>
     */
    private function recentEmployees(Organization $organization, array $filters): array
    {
        return $this->employeeQuery($organization, $filters)
            ->with(['department:id,code,name', 'location:id,code,name'])
            ->orderBy($filters['sort_by'], $filters['sort_direction'])
            ->limit($filters['recent_limit'])
            ->get()
            ->map(fn (Employee $employee) => $this->employeeSummary($employee))
            ->all();
    }

    /**
     * @param array<string, mixed> $filters
     *
     * @return array<int, array<string, mixed>>
     */
    private function recentInvitations(Organization $organization, array $filters): array
    {
        return EmployeeInvitation::query()
            ->with('employee:id,employee_number,first_name,last_name')
            ->where('organization_id', $organization->id)
            ->latest('id')
            ->limit($filters['recent_limit'])
            ->get()
            ->map(fn (EmployeeInvitation $invitation) => [
                'id' => $invitation->id,
                'email' => $invitation->email,
                'status' => $invitation->status,
                'expires_at' => $invitation->expires_at,
                'accepted_at' => $invitation->accepted_at,
                'employee' => $invitation->employee ? $this->employeeSummary($invitation->employee) : null,
            ])
            ->all();
    }

    /**
     * @return array<string, mixed>
     */
    private function setupCompletion(Organization $organization): array
    {
        $items = [
            'locations' => OrganizationLocation::query()->where('organization_id', $organization->id)->exists(),
            'departments' => Department::query()->where('organization_id', $organization->id)->exists(),
            'units' => Unit::query()->where('organization_id', $organization->id)->exists(),
            'designations' => Designation::query()->where('organization_id', $organization->id)->exists(),
            'grade_levels' => GradeLevel::query()->where('organization_id', $organization->id)->exists(),
            'employment_types' => EmploymentType::query()->where('organization_id', $organization->id)->exists(),
            'employees' => Employee::query()->where('organization_id', $organization->id)->exists(),
        ];
        $completed = collect($items)->filter()->count();

        return [
            'completed' => $completed,
            'total' => count($items),
            'percentage' => (int) round(($completed / count($items)) * 100),
            'items' => $items,
        ];
    }

    /**
     * @return array<int, array<string, string>>
     */
    private function pendingActions(Employee $employee): array
    {
        $actions = [];

        if (! $employee->profile || $employee->profile->completion_status === 'pending') {
            $actions[] = [
                'key' => 'complete_profile',
                'label' => 'Complete your employee profile.',
            ];
        }

        if ($employee->profile?->completion_status === 'submitted' && $employee->status === 'onboarding') {
            $actions[] = [
                'key' => 'profile_approval',
                'label' => 'Your submitted profile is awaiting HR approval.',
            ];
        }

        if ($employee->leaveRequests()->where('status', 'submitted')->exists()) {
            $actions[] = [
                'key' => 'leave_approval',
                'label' => 'Your leave request is awaiting approval.',
            ];
        }

        return $actions;
    }

    /**
     * @param \Illuminate\Support\Collection<int, int> $employeeIds
     *
     * @return array<string, mixed>
     */
    private function leaveMetricsForEmployees($employeeIds): array
    {
        return [
            'available' => true,
            'pending_requests' => LeaveRequest::query()->whereIn('employee_id', $employeeIds)->where('status', 'submitted')->count(),
            'approved_requests' => LeaveRequest::query()->whereIn('employee_id', $employeeIds)->where('status', 'approved')->count(),
            'rejected_requests' => LeaveRequest::query()->whereIn('employee_id', $employeeIds)->where('status', 'rejected')->count(),
            'days_pending' => (float) LeaveRequest::query()->whereIn('employee_id', $employeeIds)->where('status', 'submitted')->sum('total_days'),
            'days_approved' => (float) LeaveRequest::query()->whereIn('employee_id', $employeeIds)->where('status', 'approved')->sum('total_days'),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function leaveSummaryForEmployee(Employee $employee): array
    {
        return [
            'pending_requests' => $employee->leaveRequests()->where('status', 'submitted')->count(),
            'approved_requests' => $employee->leaveRequests()->where('status', 'approved')->count(),
            'balances' => LeaveEntitlement::query()
                ->with('leaveType:id,name,code')
                ->where('employee_id', $employee->id)
                ->get()
                ->map(fn (LeaveEntitlement $entitlement) => [
                    'leave_type' => $this->lookupPayload($entitlement->leaveType),
                    'days_allocated' => (float) $entitlement->days_allocated,
                    'days_used' => (float) $entitlement->days_used,
                    'days_pending' => (float) $entitlement->days_pending,
                    'days_available' => max((float) $entitlement->days_allocated - (float) $entitlement->days_used - (float) $entitlement->days_pending, 0),
                ])
                ->values()
                ->all(),
        ];
    }

    private function attendanceMetricsForEmployees($employeeIds): array
    {
        return [
            'available' => true,
            'present' => AttendanceRecord::query()->whereIn('employee_id', $employeeIds)->where('status', 'present')->count(),
            'late' => AttendanceRecord::query()->whereIn('employee_id', $employeeIds)->where('status', 'late')->count(),
            'absent' => AttendanceRecord::query()->whereIn('employee_id', $employeeIds)->where('status', 'absent')->count(),
            'corrections_pending' => AttendanceCorrectionRequest::query()->whereIn('employee_id', $employeeIds)->where('status', 'submitted')->count(),
            'duration_minutes' => (int) AttendanceRecord::query()->whereIn('employee_id', $employeeIds)->sum('duration_minutes'),
        ];
    }

    private function attendanceSummaryForEmployee(Employee $employee): array
    {
        return [
            'recent_records' => $employee->attendanceRecords()
                ->latest('attendance_date')
                ->limit(5)
                ->get(['id', 'attendance_date', 'check_in_at', 'check_out_at', 'duration_minutes', 'source', 'status'])
                ->all(),
            'corrections_pending' => $employee->attendanceCorrectionRequests()->where('status', 'submitted')->count(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function employeePayload(Employee $employee): array
    {
        return [
            ...$this->employeeSummary($employee),
            'phone' => $employee->phone,
            'status' => $employee->status,
            'start_date' => $employee->start_date,
            'invited_at' => $employee->invited_at,
            'onboarding_completed_at' => $employee->onboarding_completed_at,
            'activated_at' => $employee->activated_at,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function employeeSummary(Employee $employee): array
    {
        return [
            'id' => $employee->id,
            'employee_number' => $employee->employee_number,
            'first_name' => $employee->first_name,
            'last_name' => $employee->last_name,
            'full_name' => trim($employee->first_name.' '.$employee->last_name),
            'work_email' => $employee->work_email,
            'department' => $this->lookupPayload($employee->department),
            'location' => $this->lookupPayload($employee->location),
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    private function lookupPayload(mixed $model): ?array
    {
        if (! $model) {
            return null;
        }

        return [
            'id' => $model->id,
            'code' => $model->code,
            'name' => $model->name,
        ];
    }

    /**
     * @return array<int, string>
     */
    private function dateColumns(): array
    {
        return ['created_at', 'updated_at', 'start_date', 'invited_at', 'activated_at', 'onboarding_completed_at'];
    }

    /**
     * @return array<int, string>
     */
    private function sortColumns(): array
    {
        return ['id', 'created_at', 'updated_at', 'start_date', 'invited_at', 'activated_at', 'employee_number', 'first_name', 'last_name'];
    }
}
