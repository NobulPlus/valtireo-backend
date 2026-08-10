<?php

namespace App\Services;

use App\Models\ApprovalRequest;
use App\Models\ApprovalWorkflow;
use App\Models\AttendanceCorrectionRequest;
use App\Models\AttendanceRecord;
use App\Models\Department;
use App\Models\Designation;
use App\Models\DocumentRequirement;
use App\Models\DocumentType;
use App\Models\Employee;
use App\Models\EmployeeCustomField;
use App\Models\EmployeeDocument;
use App\Models\EmployeeProfileActivity;
use App\Models\EmploymentType;
use App\Models\GradeLevel;
use App\Models\LeaveEntitlement;
use App\Models\LeaveRequest;
use App\Models\Organization;
use App\Models\OrganizationLocation;
use App\Models\Unit;
use App\Models\User;
use App\Models\WorkShift;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use OwenIt\Auditing\Models\Audit;

class AuditVisibilityService
{
    /**
     * @return array<string, mixed>
     */
    public function auditLogs(User $user, Request $request): array
    {
        $perPage = min(max($request->integer('per_page', 15), 1), 100);
        $query = Audit::query()
            ->with('user')
            ->where(function (Builder $query) use ($user): void {
                $this->scopeAuditsToOrganization($query, $user);
            })
            ->when($request->string('event')->toString(), fn (Builder $query, string $event) => $query->where('event', $event))
            ->when($request->string('auditable_type')->toString(), function (Builder $query, string $type): void {
                if ($model = $this->modelFromAlias($type)) {
                    $query->where('auditable_type', $model);
                }
            })
            ->when($request->integer('user_id'), fn (Builder $query, int $id) => $query->where('user_id', $id))
            ->when($request->date('date_from'), fn (Builder $query, $date) => $query->whereDate('created_at', '>=', $date->toDateString()))
            ->when($request->date('date_to'), fn (Builder $query, $date) => $query->whereDate('created_at', '<=', $date->toDateString()))
            ->latest('id');

        $audits = $query->paginate($perPage);

        return [
            'data' => $audits->getCollection()->map(fn (Audit $audit) => $this->auditPayload($audit))->values(),
            'meta' => $this->meta($audits),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function activityFeed(User $user, Request $request): array
    {
        $perPage = min(max($request->integer('per_page', 15), 1), 100);
        $activities = EmployeeProfileActivity::query()
            ->with(['employee.department', 'actor'])
            ->where('organization_id', $user->organization_id)
            ->when($request->string('event')->toString(), fn (Builder $query, string $event) => $query->where('event', $event))
            ->when($request->integer('employee_id'), fn (Builder $query, int $id) => $query->where('employee_id', $id))
            ->when($request->integer('actor_id'), fn (Builder $query, int $id) => $query->where('actor_id', $id))
            ->when($request->integer('department_id'), fn (Builder $query, int $id) => $query->whereHas('employee', fn (Builder $query) => $query->where('department_id', $id)))
            ->when($request->string('subject_type')->toString(), function (Builder $query, string $type): void {
                if ($model = $this->modelFromAlias($type)) {
                    $query->where('subject_type', $model);
                }
            })
            ->when($request->date('date_from'), fn (Builder $query, $date) => $query->whereDate('created_at', '>=', $date->toDateString()))
            ->when($request->date('date_to'), fn (Builder $query, $date) => $query->whereDate('created_at', '<=', $date->toDateString()))
            ->latest('id')
            ->paginate($perPage);

        return [
            'data' => $activities->getCollection()->map(fn (EmployeeProfileActivity $activity) => $this->activityPayload($activity))->values(),
            'meta' => $this->meta($activities),
        ];
    }

    private function scopeAuditsToOrganization(Builder $query, User $user): void
    {
        $query->where(function (Builder $query) use ($user): void {
            $query->where(function (Builder $query) use ($user): void {
                $query->where('user_type', User::class)
                    ->where('user_id', $user->id);
            });

            foreach ($this->auditableTables() as $model => $table) {
                $query->orWhere(function (Builder $query) use ($user, $model, $table): void {
                    $query->where('auditable_type', $model)
                        ->whereExists(function ($subQuery) use ($user, $table): void {
                            $subQuery->select(DB::raw(1))
                                ->from($table)
                                ->whereColumn("{$table}.id", 'audits.auditable_id')
                                ->where("{$table}.organization_id", $user->organization_id);
                        });
                });
            }

            $query->orWhere(function (Builder $query) use ($user): void {
                $query->where('auditable_type', User::class)
                    ->whereExists(function ($subQuery) use ($user): void {
                        $subQuery->select(DB::raw(1))
                            ->from('users')
                            ->whereColumn('users.id', 'audits.auditable_id')
                            ->where('users.organization_id', $user->organization_id);
                    });
            });

            $query->orWhere(function (Builder $query) use ($user): void {
                $query->where('auditable_type', Organization::class)
                    ->where('auditable_id', $user->organization_id);
            });
        });
    }

    /**
     * @return array<class-string, string>
     */
    private function auditableTables(): array
    {
        return [
            ApprovalRequest::class => 'approval_requests',
            ApprovalWorkflow::class => 'approval_workflows',
            AttendanceCorrectionRequest::class => 'attendance_correction_requests',
            AttendanceRecord::class => 'attendance_records',
            Department::class => 'departments',
            Designation::class => 'designations',
            DocumentRequirement::class => 'document_requirements',
            DocumentType::class => 'document_types',
            Employee::class => 'employees',
            EmployeeCustomField::class => 'employee_custom_fields',
            EmployeeDocument::class => 'employee_documents',
            EmployeeProfileActivity::class => 'employee_profile_activities',
            EmploymentType::class => 'employment_types',
            GradeLevel::class => 'grade_levels',
            LeaveEntitlement::class => 'leave_entitlements',
            LeaveRequest::class => 'leave_requests',
            OrganizationLocation::class => 'organization_locations',
            Unit::class => 'units',
            WorkShift::class => 'work_shifts',
        ];
    }

    /**
     * @return array<string, class-string>
     */
    private function modelAliases(): array
    {
        return collect([...array_keys($this->auditableTables()), User::class, Organization::class])
            ->mapWithKeys(fn (string $model) => [
                str($model)->afterLast('\\')->snake()->toString() => $model,
                $model => $model,
            ])
            ->all();
    }

    private function modelFromAlias(string $alias): ?string
    {
        return $this->modelAliases()[$alias] ?? null;
    }

    /**
     * @return array<string, mixed>
     */
    private function auditPayload(Audit $audit): array
    {
        return [
            'id' => $audit->id,
            'event' => $audit->event,
            'auditable_type' => str($audit->auditable_type)->afterLast('\\')->snake()->toString(),
            'auditable_class' => $audit->auditable_type,
            'auditable_id' => $audit->auditable_id,
            'user' => $audit->user ? [
                'id' => $audit->user->id,
                'name' => $audit->user->name,
                'email' => $audit->user->email,
            ] : null,
            'old_values' => $this->decodedValues($audit->old_values),
            'new_values' => $this->decodedValues($audit->new_values),
            'url' => $audit->url,
            'ip_address' => $audit->ip_address,
            'user_agent' => $audit->user_agent,
            'tags' => $audit->tags,
            'created_at' => $audit->created_at,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function activityPayload(EmployeeProfileActivity $activity): array
    {
        return [
            'id' => $activity->id,
            'event' => $activity->event,
            'title' => $activity->title,
            'description' => $activity->description,
            'employee' => [
                'id' => $activity->employee->id,
                'employee_number' => $activity->employee->employee_number,
                'full_name' => trim($activity->employee->first_name.' '.$activity->employee->last_name),
                'department' => $activity->employee->department ? [
                    'id' => $activity->employee->department->id,
                    'name' => $activity->employee->department->name,
                    'code' => $activity->employee->department->code,
                ] : null,
            ],
            'actor' => $activity->actor ? [
                'id' => $activity->actor->id,
                'name' => $activity->actor->name,
                'email' => $activity->actor->email,
            ] : null,
            'subject_type' => $activity->subject_type ? str($activity->subject_type)->afterLast('\\')->snake()->toString() : null,
            'subject_class' => $activity->subject_type,
            'subject_id' => $activity->subject_id,
            'metadata' => $activity->metadata ?? [],
            'created_at' => $activity->created_at,
        ];
    }

    private function decodedValues(mixed $values): array
    {
        if (is_array($values)) {
            return $values;
        }

        if (! is_string($values) || $values === '') {
            return [];
        }

        return json_decode($values, true) ?: [];
    }

    /**
     * @return array<string, mixed>
     */
    private function meta($paginator): array
    {
        return [
            'current_page' => $paginator->currentPage(),
            'from' => $paginator->firstItem(),
            'last_page' => $paginator->lastPage(),
            'per_page' => $paginator->perPage(),
            'to' => $paginator->lastItem(),
            'total' => $paginator->total(),
        ];
    }
}
