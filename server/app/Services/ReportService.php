<?php

namespace App\Services;

use App\Models\AttendanceRecord;
use App\Models\Employee;
use App\Models\EmployeeDocument;
use App\Models\LeaveEntitlement;
use App\Models\LeaveRequest;
use App\Models\Ticket;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class ReportService
{
    /**
     * @return Collection<int, array<string, mixed>>
     */
    public function availableFor(User $user): Collection
    {
        return collect($this->definitions())
            ->filter(fn (array $report) => $user->can('reports.view') && $user->can($report['permission']))
            ->values();
    }

    /**
     * @return array<string, mixed>
     */
    public function findFor(User $user, string $key): array
    {
        $report = collect($this->definitions())->firstWhere('key', $key);

        abort_unless($report, 404);
        abort_unless($user->can('reports.view') && $user->can($report['permission']), 403);

        return $report;
    }

    /**
     * @return array<string, mixed>
     */
    public function view(User $user, string $key, Request $request): array
    {
        $report = $this->findFor($user, $key);
        $perPage = min(max($request->integer('per_page', 15), 1), 100);
        $paginator = $this->query($user, $key, $request)->paginate($perPage);

        return [
            'report' => $this->publicDefinition($report),
            'filters' => $request->query(),
            'data' => $paginator->getCollection()->map(fn ($row) => $this->row($key, $row))->values(),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'from' => $paginator->firstItem(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'to' => $paginator->lastItem(),
                'total' => $paginator->total(),
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function export(User $user, string $key, Request $request): array
    {
        $report = $this->findFor($user, $key);

        return [
            'filename' => $report['key'].'-'.now()->format('Y-m-d-His').'.csv',
            'headers' => $report['csv_headers'],
            'callback' => function () use ($user, $key, $request, $report): void {
                $handle = fopen('php://output', 'w');
                fputcsv($handle, $report['csv_headers']);

                $this->query($user, $key, $request)->chunk(200, function ($rows) use ($handle, $key): void {
                    foreach ($rows as $row) {
                        fputcsv($handle, $this->csvRow($key, $row));
                    }
                });

                fclose($handle);
            },
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function definitions(): array
    {
        return [
            [
                'key' => 'employee_directory',
                'name' => 'Employee Directory',
                'module' => 'employees',
                'description' => 'Employees by structure, status, profile completion, and reporting line.',
                'permission' => 'employees.view',
                'filters' => ['search', 'status', 'confirmation_status', 'department_id', 'unit_id', 'designation_id', 'grade_level_id', 'employment_type_id', 'organization_location_id', 'reporting_manager_id', 'profile_status', 'date_column', 'date_from', 'date_to', 'sort_by', 'sort_direction'],
                'csv_headers' => ['Employee Number', 'Full Name', 'Work Email', 'Status', 'Confirmation Status', 'Department', 'Unit', 'Designation', 'Grade Level', 'Employment Type', 'Location', 'Reporting Manager', 'Profile Status', 'Start Date', 'Created At'],
            ],
            [
                'key' => 'document_compliance',
                'name' => 'Document Compliance',
                'module' => 'documents',
                'description' => 'Submitted employee documents by status, type, requirement, and expiry window.',
                'permission' => 'employee_documents.view',
                'filters' => ['search', 'status', 'document_type_id', 'document_requirement_id', 'employee_id', 'department_id', 'expires_from', 'expires_to', 'submitted_from', 'submitted_to', 'sort_by', 'sort_direction'],
                'csv_headers' => ['Employee Number', 'Full Name', 'Document Type', 'Requirement', 'Title', 'Status', 'Issued At', 'Expires At', 'Submitted At', 'Reviewed At'],
            ],
            [
                'key' => 'leave_balances',
                'name' => 'Leave Balances',
                'module' => 'leave',
                'description' => 'Leave allocation, used days, pending days, and available balances.',
                'permission' => 'leave_requests.view',
                'filters' => ['search', 'employee_id', 'department_id', 'leave_type_id', 'leave_period_id', 'sort_by', 'sort_direction'],
                'csv_headers' => ['Employee Number', 'Full Name', 'Leave Type', 'Leave Period', 'Allocated', 'Used', 'Pending', 'Available', 'Notes'],
            ],
            [
                'key' => 'leave_requests',
                'name' => 'Leave Requests',
                'module' => 'leave',
                'description' => 'Leave requests by employee, leave type, status, and date range.',
                'permission' => 'leave_requests.view',
                'filters' => ['search', 'employee_id', 'department_id', 'leave_type_id', 'leave_period_id', 'status', 'date_from', 'date_to', 'sort_by', 'sort_direction'],
                'csv_headers' => ['Employee Number', 'Full Name', 'Leave Type', 'Leave Period', 'Status', 'Starts On', 'Ends On', 'Total Days', 'Reason', 'Submitted At', 'Reviewed At'],
            ],
            [
                'key' => 'attendance_summary',
                'name' => 'Attendance Summary',
                'module' => 'attendance',
                'description' => 'Per-employee attendance totals, late counts, absence counts, and worked minutes.',
                'permission' => 'attendance.view',
                'filters' => ['search', 'employee_id', 'department_id', 'status', 'source', 'date_from', 'date_to', 'sort_by', 'sort_direction'],
                'csv_headers' => ['Employee Number', 'Full Name', 'Total Records', 'Present', 'Late', 'Absent', 'Half Day', 'Corrected', 'Worked Minutes'],
            ],
            [
                'key' => 'attendance_exceptions',
                'name' => 'Attendance Exceptions',
                'module' => 'attendance',
                'description' => 'Late, absent, half-day, corrected, and incomplete attendance records.',
                'permission' => 'attendance.view',
                'filters' => ['search', 'employee_id', 'department_id', 'status', 'source', 'date_from', 'date_to', 'sort_by', 'sort_direction'],
                'csv_headers' => ['Employee Number', 'Full Name', 'Attendance Date', 'Status', 'Check In', 'Check Out', 'Duration Minutes', 'Source', 'Shift', 'Notes'],
            ],
            [
                'key' => 'ticket_log',
                'name' => 'Service Desk Ticket Log',
                'module' => 'service_desk',
                'description' => 'Tickets by category, priority, status, assignee, and resolution timing.',
                'permission' => 'service_desk.view',
                'filters' => ['search', 'status', 'priority', 'ticket_category_id', 'assigned_to_user_id', 'employee_id', 'date_from', 'date_to', 'sort_by', 'sort_direction'],
                'csv_headers' => ['Employee Number', 'Full Name', 'Category', 'Priority', 'Status', 'Assigned To', 'Subject', 'Submitted At', 'Resolved At', 'SLA Due At'],
            ],
        ];
    }

    private function query(User $user, string $key, Request $request): Builder
    {
        return match ($key) {
            'employee_directory' => $this->employeeDirectoryQuery($user, $request),
            'document_compliance' => $this->documentComplianceQuery($user, $request),
            'leave_balances' => $this->leaveBalancesQuery($user, $request),
            'leave_requests' => $this->leaveRequestsQuery($user, $request),
            'attendance_summary' => $this->attendanceSummaryQuery($user, $request),
            'attendance_exceptions' => $this->attendanceExceptionsQuery($user, $request),
            'ticket_log' => $this->ticketLogQuery($user, $request),
            default => abort(404),
        };
    }

    private function employeeDirectoryQuery(User $user, Request $request): Builder
    {
        $sortBy = $this->allowed($request->string('sort_by', 'created_at')->toString(), ['id', 'created_at', 'updated_at', 'start_date', 'employee_number', 'first_name', 'last_name'], 'created_at');
        $dateColumn = $this->allowed($request->string('date_column', 'created_at')->toString(), ['created_at', 'updated_at', 'start_date', 'invited_at', 'activated_at'], 'created_at');

        return Employee::query()
            ->with(['department', 'unit', 'designation', 'gradeLevel', 'employmentType', 'location', 'reportingManager', 'profile'])
            ->where('organization_id', $user->organization_id)
            ->when($request->string('search')->toString(), fn (Builder $query, string $search) => $this->employeeSearch($query, $search))
            ->when($request->string('status')->toString(), fn (Builder $query, string $status) => $query->where('status', $status))
            ->when($request->string('confirmation_status')->toString(), fn (Builder $query, string $status) => $query->where('confirmation_status', $status))
            ->when($request->integer('department_id'), fn (Builder $query, int $id) => $query->where('department_id', $id))
            ->when($request->integer('unit_id'), fn (Builder $query, int $id) => $query->where('unit_id', $id))
            ->when($request->integer('designation_id'), fn (Builder $query, int $id) => $query->where('designation_id', $id))
            ->when($request->integer('grade_level_id'), fn (Builder $query, int $id) => $query->where('grade_level_id', $id))
            ->when($request->integer('employment_type_id'), fn (Builder $query, int $id) => $query->where('employment_type_id', $id))
            ->when($request->integer('organization_location_id'), fn (Builder $query, int $id) => $query->where('organization_location_id', $id))
            ->when($request->integer('reporting_manager_id'), fn (Builder $query, int $id) => $query->where('reporting_manager_id', $id))
            ->when($request->string('profile_status')->toString(), fn (Builder $query, string $status) => $query->whereHas('profile', fn (Builder $query) => $query->where('completion_status', $status)))
            ->when($request->date('date_from'), fn (Builder $query, $date) => $query->whereDate($dateColumn, '>=', $date->toDateString()))
            ->when($request->date('date_to'), fn (Builder $query, $date) => $query->whereDate($dateColumn, '<=', $date->toDateString()))
            ->orderBy($sortBy, $this->direction($request));
    }

    private function documentComplianceQuery(User $user, Request $request): Builder
    {
        $sortBy = $this->allowed($request->string('sort_by', 'submitted_at')->toString(), ['id', 'submitted_at', 'reviewed_at', 'expires_at', 'created_at'], 'submitted_at');

        return EmployeeDocument::query()
            ->with(['employee.department', 'documentType', 'requirement'])
            ->where('organization_id', $user->organization_id)
            ->when($request->string('search')->toString(), fn (Builder $query, string $search) => $query->whereHas('employee', fn (Builder $query) => $this->employeeSearch($query, $search)))
            ->when($request->string('status')->toString(), fn (Builder $query, string $status) => $query->where('status', $status))
            ->when($request->integer('document_type_id'), fn (Builder $query, int $id) => $query->where('document_type_id', $id))
            ->when($request->integer('document_requirement_id'), fn (Builder $query, int $id) => $query->where('document_requirement_id', $id))
            ->when($request->integer('employee_id'), fn (Builder $query, int $id) => $query->where('employee_id', $id))
            ->when($request->integer('department_id'), fn (Builder $query, int $id) => $query->whereHas('employee', fn (Builder $query) => $query->where('department_id', $id)))
            ->when($request->date('expires_from'), fn (Builder $query, $date) => $query->whereDate('expires_at', '>=', $date->toDateString()))
            ->when($request->date('expires_to'), fn (Builder $query, $date) => $query->whereDate('expires_at', '<=', $date->toDateString()))
            ->when($request->date('submitted_from'), fn (Builder $query, $date) => $query->whereDate('submitted_at', '>=', $date->toDateString()))
            ->when($request->date('submitted_to'), fn (Builder $query, $date) => $query->whereDate('submitted_at', '<=', $date->toDateString()))
            ->orderBy($sortBy, $this->direction($request));
    }

    private function leaveBalancesQuery(User $user, Request $request): Builder
    {
        $sortBy = $this->allowed($request->string('sort_by', 'id')->toString(), ['id', 'days_allocated', 'days_used', 'days_pending', 'created_at'], 'id');

        return LeaveEntitlement::query()
            ->with(['employee.department', 'leaveType', 'leavePeriod'])
            ->where('organization_id', $user->organization_id)
            ->when($request->string('search')->toString(), fn (Builder $query, string $search) => $query->whereHas('employee', fn (Builder $query) => $this->employeeSearch($query, $search)))
            ->when($request->integer('employee_id'), fn (Builder $query, int $id) => $query->where('employee_id', $id))
            ->when($request->integer('department_id'), fn (Builder $query, int $id) => $query->whereHas('employee', fn (Builder $query) => $query->where('department_id', $id)))
            ->when($request->integer('leave_type_id'), fn (Builder $query, int $id) => $query->where('leave_type_id', $id))
            ->when($request->integer('leave_period_id'), fn (Builder $query, int $id) => $query->where('leave_period_id', $id))
            ->orderBy($sortBy, $this->direction($request));
    }

    private function leaveRequestsQuery(User $user, Request $request): Builder
    {
        $sortBy = $this->allowed($request->string('sort_by', 'starts_on')->toString(), ['id', 'starts_on', 'ends_on', 'total_days', 'submitted_at', 'reviewed_at'], 'starts_on');

        return LeaveRequest::query()
            ->with(['employee.department', 'leaveType', 'leavePeriod'])
            ->where('organization_id', $user->organization_id)
            ->when($request->string('search')->toString(), fn (Builder $query, string $search) => $query->whereHas('employee', fn (Builder $query) => $this->employeeSearch($query, $search)))
            ->when($request->integer('employee_id'), fn (Builder $query, int $id) => $query->where('employee_id', $id))
            ->when($request->integer('department_id'), fn (Builder $query, int $id) => $query->whereHas('employee', fn (Builder $query) => $query->where('department_id', $id)))
            ->when($request->integer('leave_type_id'), fn (Builder $query, int $id) => $query->where('leave_type_id', $id))
            ->when($request->integer('leave_period_id'), fn (Builder $query, int $id) => $query->where('leave_period_id', $id))
            ->when($request->string('status')->toString(), fn (Builder $query, string $status) => $query->where('status', $status))
            ->when($request->date('date_from'), fn (Builder $query, $date) => $query->whereDate('starts_on', '>=', $date->toDateString()))
            ->when($request->date('date_to'), fn (Builder $query, $date) => $query->whereDate('ends_on', '<=', $date->toDateString()))
            ->orderBy($sortBy, $this->direction($request));
    }

    private function attendanceSummaryQuery(User $user, Request $request): Builder
    {
        $sortBy = $this->allowed($request->string('sort_by', 'employee_number')->toString(), ['employee_number', 'full_name', 'total_records', 'present_count', 'late_count', 'absent_count', 'worked_minutes'], 'employee_number');
        $records = AttendanceRecord::query()
            ->selectRaw('employee_id, count(*) as total_records')
            ->selectRaw("sum(case when status = 'present' then 1 else 0 end) as present_count")
            ->selectRaw("sum(case when status = 'late' then 1 else 0 end) as late_count")
            ->selectRaw("sum(case when status = 'absent' then 1 else 0 end) as absent_count")
            ->selectRaw("sum(case when status = 'half_day' then 1 else 0 end) as half_day_count")
            ->selectRaw("sum(case when status = 'corrected' then 1 else 0 end) as corrected_count")
            ->selectRaw('sum(duration_minutes) as worked_minutes')
            ->where('organization_id', $user->organization_id)
            ->when($request->string('status')->toString(), fn (Builder $query, string $status) => $query->where('status', $status))
            ->when($request->string('source')->toString(), fn (Builder $query, string $source) => $query->where('source', $source))
            ->when($request->date('date_from'), fn (Builder $query, $date) => $query->whereDate('attendance_date', '>=', $date->toDateString()))
            ->when($request->date('date_to'), fn (Builder $query, $date) => $query->whereDate('attendance_date', '<=', $date->toDateString()))
            ->groupBy('employee_id');

        return Employee::query()
            ->select('employees.*')
            ->selectRaw("concat(first_name, ' ', last_name) as full_name")
            ->selectRaw('coalesce(attendance_totals.total_records, 0) as total_records')
            ->selectRaw('coalesce(attendance_totals.present_count, 0) as present_count')
            ->selectRaw('coalesce(attendance_totals.late_count, 0) as late_count')
            ->selectRaw('coalesce(attendance_totals.absent_count, 0) as absent_count')
            ->selectRaw('coalesce(attendance_totals.half_day_count, 0) as half_day_count')
            ->selectRaw('coalesce(attendance_totals.corrected_count, 0) as corrected_count')
            ->selectRaw('coalesce(attendance_totals.worked_minutes, 0) as worked_minutes')
            ->leftJoinSub($records, 'attendance_totals', 'attendance_totals.employee_id', '=', 'employees.id')
            ->where('employees.organization_id', $user->organization_id)
            ->when($request->string('search')->toString(), fn (Builder $query, string $search) => $this->employeeSearch($query, $search))
            ->when($request->integer('employee_id'), fn (Builder $query, int $id) => $query->where('employees.id', $id))
            ->when($request->integer('department_id'), fn (Builder $query, int $id) => $query->where('department_id', $id))
            ->orderBy($sortBy, $this->direction($request));
    }

    private function attendanceExceptionsQuery(User $user, Request $request): Builder
    {
        $sortBy = $this->allowed($request->string('sort_by', 'attendance_date')->toString(), ['id', 'attendance_date', 'check_in_at', 'check_out_at', 'duration_minutes', 'status'], 'attendance_date');

        return AttendanceRecord::query()
            ->with(['employee.department', 'workShift'])
            ->where('organization_id', $user->organization_id)
            ->where(function (Builder $query): void {
                $query->whereIn('status', ['late', 'absent', 'half_day', 'corrected'])
                    ->orWhereNull('check_in_at')
                    ->orWhereNull('check_out_at');
            })
            ->when($request->string('search')->toString(), fn (Builder $query, string $search) => $query->whereHas('employee', fn (Builder $query) => $this->employeeSearch($query, $search)))
            ->when($request->integer('employee_id'), fn (Builder $query, int $id) => $query->where('employee_id', $id))
            ->when($request->integer('department_id'), fn (Builder $query, int $id) => $query->whereHas('employee', fn (Builder $query) => $query->where('department_id', $id)))
            ->when($request->string('status')->toString(), fn (Builder $query, string $status) => $query->where('status', $status))
            ->when($request->string('source')->toString(), fn (Builder $query, string $source) => $query->where('source', $source))
            ->when($request->date('date_from'), fn (Builder $query, $date) => $query->whereDate('attendance_date', '>=', $date->toDateString()))
            ->when($request->date('date_to'), fn (Builder $query, $date) => $query->whereDate('attendance_date', '<=', $date->toDateString()))
            ->orderBy($sortBy, $this->direction($request));
    }

    private function ticketLogQuery(User $user, Request $request): Builder
    {
        $sortBy = $this->allowed($request->string('sort_by', 'submitted_at')->toString(), ['id', 'submitted_at', 'resolved_at', 'priority', 'status'], 'submitted_at');

        return Ticket::query()
            ->with(['employee.department', 'category', 'assignedTo'])
            ->where('organization_id', $user->organization_id)
            ->when($request->string('search')->toString(), fn (Builder $query, string $search) => $query->whereHas('employee', fn (Builder $query) => $this->employeeSearch($query, $search)))
            ->when($request->string('status')->toString(), fn (Builder $query, string $status) => $query->where('status', $status))
            ->when($request->string('priority')->toString(), fn (Builder $query, string $priority) => $query->where('priority', $priority))
            ->when($request->integer('ticket_category_id'), fn (Builder $query, int $id) => $query->where('ticket_category_id', $id))
            ->when($request->integer('assigned_to_user_id'), fn (Builder $query, int $id) => $query->where('assigned_to_user_id', $id))
            ->when($request->integer('employee_id'), fn (Builder $query, int $id) => $query->where('employee_id', $id))
            ->when($request->date('date_from'), fn (Builder $query, $date) => $query->whereDate('submitted_at', '>=', $date->toDateString()))
            ->when($request->date('date_to'), fn (Builder $query, $date) => $query->whereDate('submitted_at', '<=', $date->toDateString()))
            ->orderBy($sortBy, $this->direction($request));
    }

    private function row(string $key, mixed $row): array
    {
        return match ($key) {
            'employee_directory' => [
                'id' => $row->id,
                'employee_number' => $row->employee_number,
                'full_name' => trim($row->first_name.' '.$row->last_name),
                'work_email' => $row->work_email,
                'status' => $row->status,
                'confirmation_status' => $row->confirmation_status,
                'department' => $row->department?->name,
                'unit' => $row->unit?->name,
                'designation' => $row->designation?->name,
                'grade_level' => $row->gradeLevel?->name,
                'employment_type' => $row->employmentType?->name,
                'location' => $row->location?->name,
                'reporting_manager' => $row->reportingManager ? trim($row->reportingManager->first_name.' '.$row->reportingManager->last_name) : null,
                'profile_status' => $row->profile?->completion_status,
                'start_date' => $row->start_date?->toDateString(),
                'created_at' => $row->created_at?->toDateTimeString(),
            ],
            'document_compliance' => [
                'id' => $row->id,
                'employee_number' => $row->employee?->employee_number,
                'full_name' => $this->employeeName($row->employee),
                'document_type' => $row->documentType?->name,
                'requirement' => $row->requirement?->name,
                'title' => $row->title,
                'status' => $row->status,
                'issued_at' => $row->issued_at?->toDateString(),
                'expires_at' => $row->expires_at?->toDateString(),
                'submitted_at' => $row->submitted_at?->toDateTimeString(),
                'reviewed_at' => $row->reviewed_at?->toDateTimeString(),
            ],
            'leave_balances' => [
                'id' => $row->id,
                'employee_number' => $row->employee?->employee_number,
                'full_name' => $this->employeeName($row->employee),
                'leave_type' => $row->leaveType?->name,
                'leave_period' => $row->leavePeriod?->name,
                'days_allocated' => (float) $row->days_allocated,
                'days_used' => (float) $row->days_used,
                'days_pending' => (float) $row->days_pending,
                'days_available' => max((float) $row->days_allocated - (float) $row->days_used - (float) $row->days_pending, 0),
                'notes' => $row->notes,
            ],
            'leave_requests' => [
                'id' => $row->id,
                'employee_number' => $row->employee?->employee_number,
                'full_name' => $this->employeeName($row->employee),
                'leave_type' => $row->leaveType?->name,
                'leave_period' => $row->leavePeriod?->name,
                'status' => $row->status,
                'starts_on' => $row->starts_on?->toDateString(),
                'ends_on' => $row->ends_on?->toDateString(),
                'total_days' => (float) $row->total_days,
                'reason' => $row->reason,
                'submitted_at' => $row->submitted_at?->toDateTimeString(),
                'reviewed_at' => $row->reviewed_at?->toDateTimeString(),
            ],
            'attendance_summary' => [
                'employee_id' => $row->id,
                'employee_number' => $row->employee_number,
                'full_name' => trim($row->first_name.' '.$row->last_name),
                'total_records' => (int) $row->total_records,
                'present_count' => (int) $row->present_count,
                'late_count' => (int) $row->late_count,
                'absent_count' => (int) $row->absent_count,
                'half_day_count' => (int) $row->half_day_count,
                'corrected_count' => (int) $row->corrected_count,
                'worked_minutes' => (int) $row->worked_minutes,
            ],
            'attendance_exceptions' => [
                'id' => $row->id,
                'employee_number' => $row->employee?->employee_number,
                'full_name' => $this->employeeName($row->employee),
                'attendance_date' => $row->attendance_date?->toDateString(),
                'status' => $row->status,
                'check_in_at' => $row->check_in_at?->toDateTimeString(),
                'check_out_at' => $row->check_out_at?->toDateTimeString(),
                'duration_minutes' => $row->duration_minutes,
                'source' => $row->source,
                'work_shift' => $row->workShift?->name,
                'notes' => $row->notes,
            ],
            'ticket_log' => [
                'id' => $row->id,
                'employee_number' => $row->employee?->employee_number,
                'full_name' => $this->employeeName($row->employee),
                'category' => $row->category?->name,
                'priority' => $row->priority,
                'status' => $row->status,
                'assigned_to' => $row->assignedTo?->name,
                'subject' => $row->subject,
                'submitted_at' => $row->submitted_at?->toDateTimeString(),
                'resolved_at' => $row->resolved_at?->toDateTimeString(),
                'sla_due_at' => $row->sla_due_at?->toDateTimeString(),
            ],
            default => [],
        };
    }

    private function csvRow(string $key, mixed $row): array
    {
        $data = $this->row($key, $row);

        return match ($key) {
            'employee_directory' => [$data['employee_number'], $data['full_name'], $data['work_email'], $data['status'], $data['confirmation_status'], $data['department'], $data['unit'], $data['designation'], $data['grade_level'], $data['employment_type'], $data['location'], $data['reporting_manager'], $data['profile_status'], $data['start_date'], $data['created_at']],
            'document_compliance' => [$data['employee_number'], $data['full_name'], $data['document_type'], $data['requirement'], $data['title'], $data['status'], $data['issued_at'], $data['expires_at'], $data['submitted_at'], $data['reviewed_at']],
            'leave_balances' => [$data['employee_number'], $data['full_name'], $data['leave_type'], $data['leave_period'], $data['days_allocated'], $data['days_used'], $data['days_pending'], $data['days_available'], $data['notes']],
            'leave_requests' => [$data['employee_number'], $data['full_name'], $data['leave_type'], $data['leave_period'], $data['status'], $data['starts_on'], $data['ends_on'], $data['total_days'], $data['reason'], $data['submitted_at'], $data['reviewed_at']],
            'attendance_summary' => [$data['employee_number'], $data['full_name'], $data['total_records'], $data['present_count'], $data['late_count'], $data['absent_count'], $data['half_day_count'], $data['corrected_count'], $data['worked_minutes']],
            'attendance_exceptions' => [$data['employee_number'], $data['full_name'], $data['attendance_date'], $data['status'], $data['check_in_at'], $data['check_out_at'], $data['duration_minutes'], $data['source'], $data['work_shift'], $data['notes']],
            'ticket_log' => [$data['employee_number'], $data['full_name'], $data['category'], $data['priority'], $data['status'], $data['assigned_to'], $data['subject'], $data['submitted_at'], $data['resolved_at'], $data['sla_due_at']],
            default => [],
        };
    }

    /**
     * @return array<string, mixed>
     */
    private function publicDefinition(array $report): array
    {
        return collect($report)
            ->except('permission', 'csv_headers')
            ->all();
    }

    private function employeeSearch(Builder $query, string $search): void
    {
        $query->where(function (Builder $query) use ($search): void {
            $query
                ->where('employee_number', 'like', "%{$search}%")
                ->orWhere('first_name', 'like', "%{$search}%")
                ->orWhere('last_name', 'like', "%{$search}%")
                ->orWhere('work_email', 'like', "%{$search}%");
        });
    }

    private function employeeName(?Employee $employee): ?string
    {
        return $employee ? trim($employee->first_name.' '.$employee->last_name) : null;
    }

    /**
     * @param array<int, string> $allowed
     */
    private function allowed(string $value, array $allowed, string $fallback): string
    {
        return in_array($value, $allowed, true) ? $value : $fallback;
    }

    private function direction(Request $request): string
    {
        return strtolower($request->string('sort_direction', 'desc')->toString()) === 'asc' ? 'asc' : 'desc';
    }
}
