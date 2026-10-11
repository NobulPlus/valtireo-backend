<?php

namespace App\Services;

use App\Models\ApprovalRequest;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

final class ApprovalVisibility
{
    public function query(User $actor): Builder
    {
        $query = ApprovalRequest::query()->where('organization_id', $actor->organization_id);
        if ($actor->can('organizations.administer')) {
            return $query;
        }

        $employees = app(EmployeeVisibility::class);
        return $query->where(function (Builder $scope) use ($actor, $employees): void {
            $scope->where('requester_id', $actor->id);
            $scope->orWhereHas('decisions', fn (Builder $decisions) => $decisions->where('actor_id', $actor->id));
            foreach (['leave' => 'leave_requests.view', 'attendance' => 'attendance.view',
                'employee_documents' => 'employee_documents.view', 'service_desk' => 'service_desk.view',
                'payroll' => 'payroll.runs.view'] as $module => $permission) {
                if ($actor->can($permission)) {
                    $scope->orWhere(function (Builder $moduleQuery) use ($module, $actor, $employees): void {
                        $moduleQuery->where('module', $module);
                        if (! $employees->organizationWide($actor)) {
                            $moduleQuery->whereIn('subject_employee_id', $employees->ids($actor));
                        }
                    });
                }
            }

            // A workflow assignment is an explicit grant to its current reviewer.
            if ($actor->employee) {
                foreach (['direct_manager', 'department_head'] as $type) {
                    $scope->orWhere(function (Builder $assigned) use ($actor, $type): void {
                        $assigned->whereHas('workflow.steps', fn (Builder $steps) => $steps
                            ->where('is_active', true)->where('approver_type', $type)
                            ->whereColumn('step_order', 'approval_requests.current_step_order'));
                        if ($type === 'direct_manager') {
                            $assigned->whereHas('subjectEmployee', fn (Builder $employee) => $employee
                                ->where('organization_id', $actor->organization_id)
                                ->where('reporting_manager_id', $actor->employee->id));
                        } else {
                            $assigned->whereHas('subjectEmployee.department', fn (Builder $department) => $department
                                ->where('organization_id', $actor->organization_id)
                                ->where('head_employee_id', $actor->employee->id));
                        }
                    });
                }
            }

            $scope->orWhereHas('workflow.steps', function (Builder $steps) use ($actor): void {
                $steps->where('is_active', true)
                    ->whereColumn('step_order', 'approval_requests.current_step_order')
                    ->where(function (Builder $assigned) use ($actor): void {
                        $assigned->where(function (Builder $roles) use ($actor): void {
                            $roles->where('approver_type', 'role')
                                ->whereIn('approver_role_id', $actor->roles->pluck('id'));
                        })->orWhere(function (Builder $permissions) use ($actor): void {
                            $permissions->where('approver_type', 'permission')
                                ->whereIn('approver_permission', $actor->getAllPermissions()->pluck('name'));
                        });
                    });
            });
        });
    }
}
