<?php

namespace App\Http\Requests\Employees;

use App\Models\Cluster;
use App\Models\Unit;
use App\Services\EmployeeRoleAssignmentService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreEmployeeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('employees.create') ?? false;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $organizationId = $this->user()?->organization_id;

        return [
            'employee_number' => [
                'required',
                'string',
                'max:50',
                Rule::unique('employees', 'employee_number')->where('organization_id', $organizationId),
            ],
            'first_name' => ['required', 'string', 'max:255'],
            'middle_name' => ['nullable', 'string', 'max:255'],
            'last_name' => ['required', 'string', 'max:255'],
            'work_email' => [
                'required',
                'email',
                'max:255',
                Rule::unique('employees', 'work_email')->where('organization_id', $organizationId),
            ],
            'phone' => ['nullable', 'string', 'max:50'],
            'department_id' => [
                'required',
                Rule::exists('departments', 'id')->where('organization_id', $organizationId),
            ],
            'unit_id' => [
                'nullable',
                Rule::exists('units', 'id')->where('organization_id', $organizationId),
            ],
            'cluster_id' => [
                'nullable',
                Rule::exists('clusters', 'id')->where('organization_id', $organizationId),
            ],
            'designation_id' => [
                'required',
                Rule::exists('designations', 'id')->where('organization_id', $organizationId),
            ],
            'grade_level_id' => [
                'nullable',
                Rule::exists('grade_levels', 'id')->where('organization_id', $organizationId),
            ],
            'employment_type_id' => [
                'required',
                Rule::exists('employment_types', 'id')->where('organization_id', $organizationId),
            ],
            'organization_location_id' => [
                'required',
                Rule::exists('organization_locations', 'id')->where('organization_id', $organizationId),
            ],
            'reporting_manager_id' => [
                'nullable',
                Rule::exists('employees', 'id')->where('organization_id', $organizationId),
            ],
            'start_date' => ['nullable', 'date'],
            'pending_role_id' => [
                'nullable',
                Rule::in(app(EmployeeRoleAssignmentService::class)->assignableRolesFor($this->user())->pluck('id')),
            ],
            'send_invitation' => ['sometimes', 'boolean'],
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator): void {
            $organizationId = $this->user()?->organization_id;

            if (! $organizationId) {
                return;
            }

            if ($this->filled('unit_id')) {
                $unit = Unit::query()
                    ->where('organization_id', $organizationId)
                    ->whereKey($this->integer('unit_id'))
                    ->first();

                if ($unit && $unit->department_id !== $this->integer('department_id')) {
                    $validator->errors()->add('unit_id', 'The selected unit does not belong to the selected department.');
                }
            }

            if ($this->filled('cluster_id')) {
                $cluster = Cluster::query()
                    ->where('organization_id', $organizationId)
                    ->whereKey($this->integer('cluster_id'))
                    ->first();

                if ($cluster && $cluster->department_id !== $this->integer('department_id')) {
                    $validator->errors()->add('cluster_id', 'The selected cluster does not belong to the selected department.');
                }
            }
        });
    }

    /**
     * @return array<string, mixed>
     */
    public function safeEmployeeData(): array
    {
        return $this->safe()->only([
            'employee_number',
            'first_name',
            'middle_name',
            'last_name',
            'work_email',
            'phone',
            'department_id',
            'unit_id',
            'cluster_id',
            'designation_id',
            'grade_level_id',
            'employment_type_id',
            'organization_location_id',
            'reporting_manager_id',
            'start_date',
            'pending_role_id',
        ]);
    }
}
