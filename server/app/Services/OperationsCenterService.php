<?php

namespace App\Services;

use App\Models\ApprovalRequest;
use App\Models\AttendanceCorrectionRequest;
use App\Models\EmployeeDocument;
use App\Models\OperationTask;
use App\Models\PayrollRun;
use App\Models\Ticket;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\LengthAwarePaginator;

class OperationsCenterService
{
    public function tasks(User $user, array $filters = []): LengthAwarePaginator
    {
        $query = OperationTask::query()
            ->where('organization_id', $user->organization_id)
            ->with(['assignedUser:id,name,email', 'subjectEmployee:id,first_name,last_name,employee_number', 'createdBy:id,name']);

        $this->scopeVisible($query, $user);

        foreach (['status', 'category', 'priority'] as $field) {
            if (! empty($filters[$field])) {
                $query->where($field, $filters[$field]);
            }
        }

        if (! empty($filters['assigned_user_id'])) {
            $query->where('assigned_user_id', $filters['assigned_user_id']);
        }
        if (! empty($filters['search'])) {
            $search = $filters['search'];
            $query->where(fn (Builder $q) => $q->where('title', 'like', "%{$search}%")
                ->orWhere('description', 'like', "%{$search}%"));
        }
        if (! empty($filters['due_from'])) {
            $query->whereDate('due_at', '>=', $filters['due_from']);
        }
        if (! empty($filters['due_to'])) {
            $query->whereDate('due_at', '<=', $filters['due_to']);
        }

        $sort = in_array($filters['sort'] ?? null, ['created_at', 'due_at', 'priority', 'status', 'title'], true)
            ? $filters['sort'] : 'due_at';
        $direction = ($filters['direction'] ?? 'asc') === 'desc' ? 'desc' : 'asc';

        return $query->orderByRaw($sort === 'due_at' ? 'due_at IS NULL' : '0')
            ->orderBy($sort, $direction)
            ->paginate(min((int) ($filters['per_page'] ?? 20), 100));
    }

    public function summary(User $user): array
    {
        $query = OperationTask::query()->where('organization_id', $user->organization_id);
        $this->scopeVisible($query, $user);

        return [
            'open' => (clone $query)->whereIn('status', ['open', 'in_progress'])->count(),
            'overdue' => (clone $query)->whereIn('status', ['open', 'in_progress'])->where('due_at', '<', now())->count(),
            'due_soon' => (clone $query)->whereIn('status', ['open', 'in_progress'])->whereBetween('due_at', [now(), now()->addDays(7)])->count(),
            'critical' => (clone $query)->whereIn('status', ['open', 'in_progress'])->where('priority', 'critical')->count(),
            'assigned_to_me' => (clone $query)->where('assigned_user_id', $user->id)->whereIn('status', ['open', 'in_progress'])->count(),
        ];
    }

    public function signals(User $user): array
    {
        if (! $this->canManage($user)) {
            return [];
        }

        $organizationId = $user->organization_id;
        $signals = [
            $this->signal('pending_approvals', 'approvals', 'Pending approvals', ApprovalRequest::query()->where('organization_id', $organizationId)->where('status', 'pending')->count(), '/approvals'),
            $this->signal('attendance_corrections', 'attendance', 'Attendance corrections awaiting review', AttendanceCorrectionRequest::query()->where('organization_id', $organizationId)->where('status', 'submitted')->count(), '/attendance'),
            $this->signal('documents_expiring', 'documents', 'Documents expiring within 30 days', EmployeeDocument::query()->where('organization_id', $organizationId)->whereNotNull('expires_at')->whereBetween('expires_at', [today(), today()->addDays(30)])->count(), '/documents'),
            $this->signal('documents_expired', 'documents', 'Expired employee documents', EmployeeDocument::query()->where('organization_id', $organizationId)->whereNotNull('expires_at')->whereDate('expires_at', '<', today())->count(), '/documents', 'critical'),
            $this->signal('overdue_tickets', 'service_desk', 'Service tickets past SLA', Ticket::query()->where('organization_id', $organizationId)->whereNotIn('status', ['resolved', 'closed', 'cancelled'])->whereNotNull('sla_due_at')->where('sla_due_at', '<', now())->count(), '/service-desk', 'critical'),
            $this->signal('payroll_exceptions', 'payroll', 'Payroll runs with unresolved exceptions', PayrollRun::query()->where('organization_id', $organizationId)->where('status', 'calculated')->whereHas('items', fn (Builder $q) => $q->where('status', 'exception'))->count(), '/payroll/runs'),
        ];

        return array_values(array_filter($signals, fn (array $signal) => $signal['count'] > 0));
    }

    public function canManage(User $user): bool
    {
        return $user->is_platform_admin || $user->can('organizations.administer') || $user->can('operations.manage');
    }

    private function scopeVisible(Builder $query, User $user): void
    {
        if ($this->canManage($user)) {
            return;
        }

        $query->where(function (Builder $q) use ($user): void {
            $q->where('assigned_user_id', $user->id);
            if ($user->employee) {
                $q->orWhere('subject_employee_id', $user->employee->id);
            }
        });
    }

    private function signal(string $key, string $category, string $title, int $count, string $actionUrl, string $severity = 'warning'): array
    {
        return compact('key', 'category', 'title', 'count', 'actionUrl', 'severity');
    }
}
