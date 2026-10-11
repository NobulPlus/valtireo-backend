<?php

namespace App\Services;

use App\Models\Cluster;
use App\Models\Department;
use App\Models\Employee;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

final class EmployeeVisibility
{
    public function organizationWide(User $actor): bool
    {
        return $actor->can('organizations.administer') || $actor->can('employees.view_all');
    }

    public function query(User $actor): Builder
    {
        $query = Employee::query()->where('employees.organization_id', $actor->organization_id);
        if ($this->organizationWide($actor)) {
            return $query;
        }

        $employee = $actor->employee()->where('organization_id', $actor->organization_id)->first();
        if (! $employee) {
            return $query->whereRaw('1 = 0');
        }

        return $query->where(function (Builder $scope) use ($actor, $employee): void {
            $scope->where('employees.id', $employee->id);
            if ($actor->can('employees.view_team')) {
                $scope->orWhere('employees.reporting_manager_id', $employee->id)
                    ->orWhereIn('employees.cluster_id', Cluster::query()
                        ->select('id')->where('organization_id', $actor->organization_id)->where('is_active', true)
                        ->where(fn (Builder $q) => $q->where('manager_employee_id', $employee->id)->orWhere('supervisor_employee_id', $employee->id)));
            }
            if ($actor->can('employees.view_department')) {
                $scope->orWhereIn('employees.department_id', Department::query()
                    ->select('id')->where('organization_id', $actor->organization_id)
                    ->where('head_employee_id', $employee->id));
            }
        });
    }

    public function ids(User $actor): Builder
    {
        return $this->query($actor)->select('employees.id');
    }

    public function allows(User $actor, int $employeeId): bool
    {
        return $this->query($actor)->whereKey($employeeId)->exists();
    }
}
