<?php

namespace App\Services;

use App\Models\Employee;
use App\Models\EmployeeCustomFieldValue;
use App\Models\User;
use Illuminate\Support\Collection;

final class EmployeeFieldVisibility
{
    public static function values(Employee $employee, Collection $values, ?User $actor): Collection
    {
        if (! $actor || $actor->organization_id !== $employee->organization_id) {
            return collect();
        }

        // A self-profile never reveals fields marked hidden from that employee,
        // including when that employee also holds an administrative role.
        if ($employee->user_id !== $actor->id && $actor->can('employees.view')) {
            return $values;
        }

        return $values->filter(fn (EmployeeCustomFieldValue $value) =>
            $value->field?->is_active && $value->field?->visible_to_employee
        )->values();
    }
}
