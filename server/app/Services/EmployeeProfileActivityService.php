<?php

namespace App\Services;

use App\Models\Employee;
use App\Models\EmployeeProfileActivity;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;

class EmployeeProfileActivityService
{
    /**
     * @param array<string, mixed> $metadata
     */
    public function record(
        Employee $employee,
        ?User $actor,
        string $event,
        string $title,
        ?string $description = null,
        ?Model $subject = null,
        array $metadata = []
    ): EmployeeProfileActivity {
        return EmployeeProfileActivity::query()->create([
            'organization_id' => $employee->organization_id,
            'employee_id' => $employee->id,
            'actor_id' => $actor?->id,
            'event' => $event,
            'subject_type' => $subject ? $subject::class : null,
            'subject_id' => $subject?->getKey(),
            'title' => $title,
            'description' => $description,
            'metadata' => $metadata,
        ]);
    }
}
