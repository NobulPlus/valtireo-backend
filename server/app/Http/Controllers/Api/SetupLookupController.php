<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Department;
use App\Models\Designation;
use App\Models\EmploymentType;
use App\Models\GradeLevel;
use App\Models\OrganizationLocation;
use App\Models\Unit;
use App\Services\EmployeeRoleAssignmentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class SetupLookupController extends Controller
{
    public function index(Request $request, EmployeeRoleAssignmentService $roleAssignment): JsonResponse
    {
        return response()->json([
            'departments' => $this->departments($request)->getData(true)['data'],
            'units' => $this->units($request)->getData(true)['data'],
            'designations' => $this->designations($request)->getData(true)['data'],
            'grade_levels' => $this->gradeLevels($request)->getData(true)['data'],
            'employment_types' => $this->employmentTypes($request)->getData(true)['data'],
            'locations' => $this->locations($request)->getData(true)['data'],
            'assignable_roles' => $this->assignableRoles($request, $roleAssignment)->getData(true)['data'],
        ]);
    }

    public function assignableRoles(Request $request, EmployeeRoleAssignmentService $roleAssignment): JsonResponse
    {
        return response()->json([
            'data' => $roleAssignment->assignableRolesFor($request->user())
                ->map(fn ($role) => ['value' => (string) $role->id, 'label' => $role->name])
                ->values(),
        ]);
    }

    public function departments(Request $request): JsonResponse
    {
        return response()->json([
            'data' => Department::query()
                ->where('organization_id', $request->user()->organization_id)
                ->where('is_active', true)
                ->orderBy('name')
                ->get(['id', 'parent_id', 'code', 'name', 'description']),
        ]);
    }

    public function units(Request $request): JsonResponse
    {
        return response()->json([
            'data' => Unit::query()
                ->with('department:id,code,name')
                ->where('organization_id', $request->user()->organization_id)
                ->where('is_active', true)
                ->when($request->integer('department_id'), fn ($query, int $departmentId) => $query->where('department_id', $departmentId))
                ->orderBy('name')
                ->get(['id', 'organization_id', 'department_id', 'code', 'name', 'description']),
        ]);
    }

    public function designations(Request $request): JsonResponse
    {
        return response()->json([
            'data' => Designation::query()
                ->where('organization_id', $request->user()->organization_id)
                ->where('is_active', true)
                ->orderBy('name')
                ->get(['id', 'code', 'name', 'description']),
        ]);
    }

    public function gradeLevels(Request $request): JsonResponse
    {
        return response()->json([
            'data' => GradeLevel::query()
                ->where('organization_id', $request->user()->organization_id)
                ->where('is_active', true)
                ->orderBy('rank')
                ->get(['id', 'code', 'name', 'rank', 'description']),
        ]);
    }

    public function employmentTypes(Request $request): JsonResponse
    {
        return response()->json([
            'data' => EmploymentType::query()
                ->where('organization_id', $request->user()->organization_id)
                ->where('is_active', true)
                ->orderBy('name')
                ->get(['id', 'code', 'name', 'description']),
        ]);
    }

    public function locations(Request $request): JsonResponse
    {
        return response()->json([
            'data' => OrganizationLocation::query()
                ->where('organization_id', $request->user()->organization_id)
                ->where('is_active', true)
                ->orderByDesc('is_primary')
                ->orderBy('name')
                ->get(['id', 'code', 'name', 'type', 'city', 'state', 'country', 'is_primary']),
        ]);
    }

    public function storeDepartment(Request $request): JsonResponse
    {
        abort_unless($request->user()->can('workspace_settings.update'), 403);

        $data = $request->validate($this->departmentRules($request));

        $department = Department::query()->create([
            'organization_id' => $request->user()->organization_id,
            ...$data,
        ]);

        return response()->json(['department' => $department], 201);
    }

    public function updateDepartment(Request $request, Department $department): JsonResponse
    {
        abort_unless($request->user()->can('workspace_settings.update'), 403);
        abort_unless($department->organization_id === $request->user()->organization_id, 404);

        $department->update($request->validate($this->departmentRules($request, $department->id)));

        return response()->json(['department' => $department->refresh()]);
    }

    public function storeUnit(Request $request): JsonResponse
    {
        abort_unless($request->user()->can('workspace_settings.update'), 403);

        $unit = Unit::query()->create([
            'organization_id' => $request->user()->organization_id,
            ...$request->validate($this->unitRules($request)),
        ]);

        return response()->json(['unit' => $unit->load('department:id,code,name')], 201);
    }

    public function updateUnit(Request $request, Unit $unit): JsonResponse
    {
        abort_unless($request->user()->can('workspace_settings.update'), 403);
        abort_unless($unit->organization_id === $request->user()->organization_id, 404);

        $unit->update($request->validate($this->unitRules($request, $unit->id)));

        return response()->json(['unit' => $unit->refresh()->load('department:id,code,name')]);
    }

    public function storeDesignation(Request $request): JsonResponse
    {
        abort_unless($request->user()->can('workspace_settings.update'), 403);

        $designation = Designation::query()->create([
            'organization_id' => $request->user()->organization_id,
            ...$request->validate($this->simpleSetupRules($request, 'designations')),
        ]);

        return response()->json(['designation' => $designation], 201);
    }

    public function updateDesignation(Request $request, Designation $designation): JsonResponse
    {
        abort_unless($request->user()->can('workspace_settings.update'), 403);
        abort_unless($designation->organization_id === $request->user()->organization_id, 404);

        $designation->update($request->validate($this->simpleSetupRules($request, 'designations', $designation->id)));

        return response()->json(['designation' => $designation->refresh()]);
    }

    public function storeGradeLevel(Request $request): JsonResponse
    {
        abort_unless($request->user()->can('workspace_settings.update'), 403);

        $gradeLevel = GradeLevel::query()->create([
            'organization_id' => $request->user()->organization_id,
            ...$request->validate([
                ...$this->simpleSetupRules($request, 'grade_levels'),
                'rank' => ['sometimes', 'integer', 'min:0', 'max:999'],
            ]),
        ]);

        return response()->json(['grade_level' => $gradeLevel], 201);
    }

    public function updateGradeLevel(Request $request, GradeLevel $gradeLevel): JsonResponse
    {
        abort_unless($request->user()->can('workspace_settings.update'), 403);
        abort_unless($gradeLevel->organization_id === $request->user()->organization_id, 404);

        $gradeLevel->update($request->validate([
            ...$this->simpleSetupRules($request, 'grade_levels', $gradeLevel->id),
            'rank' => ['sometimes', 'integer', 'min:0', 'max:999'],
        ]));

        return response()->json(['grade_level' => $gradeLevel->refresh()]);
    }

    public function storeEmploymentType(Request $request): JsonResponse
    {
        abort_unless($request->user()->can('workspace_settings.update'), 403);

        $employmentType = EmploymentType::query()->create([
            'organization_id' => $request->user()->organization_id,
            ...$request->validate($this->simpleSetupRules($request, 'employment_types')),
        ]);

        return response()->json(['employment_type' => $employmentType], 201);
    }

    public function updateEmploymentType(Request $request, EmploymentType $employmentType): JsonResponse
    {
        abort_unless($request->user()->can('workspace_settings.update'), 403);
        abort_unless($employmentType->organization_id === $request->user()->organization_id, 404);

        $employmentType->update($request->validate($this->simpleSetupRules($request, 'employment_types', $employmentType->id)));

        return response()->json(['employment_type' => $employmentType->refresh()]);
    }

    public function storeLocation(Request $request): JsonResponse
    {
        abort_unless($request->user()->can('workspace_settings.update'), 403);

        $data = $request->validate($this->locationRules($request));

        if (($data['is_primary'] ?? false) === true) {
            OrganizationLocation::query()->where('organization_id', $request->user()->organization_id)->update(['is_primary' => false]);
        }

        $location = OrganizationLocation::query()->create([
            'organization_id' => $request->user()->organization_id,
            ...$data,
        ]);

        return response()->json(['location' => $location], 201);
    }

    public function updateLocation(Request $request, OrganizationLocation $location): JsonResponse
    {
        abort_unless($request->user()->can('workspace_settings.update'), 403);
        abort_unless($location->organization_id === $request->user()->organization_id, 404);

        $data = $request->validate($this->locationRules($request, $location->id));

        if (($data['is_primary'] ?? false) === true) {
            OrganizationLocation::query()
                ->where('organization_id', $request->user()->organization_id)
                ->whereKeyNot($location->id)
                ->update(['is_primary' => false]);
        }

        $location->update($data);

        return response()->json(['location' => $location->refresh()]);
    }

    /**
     * @return array<string, mixed>
     */
    private function simpleSetupRules(Request $request, string $table, ?int $ignoreId = null): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'code' => [
                'required',
                'alpha_dash',
                'max:50',
                Rule::unique($table, 'code')
                    ->where('organization_id', $request->user()?->organization_id)
                    ->ignore($ignoreId),
            ],
            'description' => ['nullable', 'string', 'max:1000'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function departmentRules(Request $request, ?int $ignoreId = null): array
    {
        return [
            ...$this->simpleSetupRules($request, 'departments', $ignoreId),
            'parent_id' => ['nullable', Rule::exists('departments', 'id')->where('organization_id', $request->user()?->organization_id)],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function unitRules(Request $request, ?int $ignoreId = null): array
    {
        return [
            ...$this->simpleSetupRules($request, 'units', $ignoreId),
            'department_id' => ['required', Rule::exists('departments', 'id')->where('organization_id', $request->user()?->organization_id)],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function locationRules(Request $request, ?int $ignoreId = null): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'code' => [
                'required',
                'alpha_dash',
                'max:50',
                Rule::unique('organization_locations', 'code')
                    ->where('organization_id', $request->user()?->organization_id)
                    ->ignore($ignoreId),
            ],
            'type' => ['sometimes', Rule::in(['head_office', 'branch', 'remote', 'field', 'warehouse'])],
            'email' => ['nullable', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:50'],
            'address' => ['nullable', 'string', 'max:1000'],
            'city' => ['nullable', 'string', 'max:255'],
            'state' => ['nullable', 'string', 'max:255'],
            'country' => ['nullable', 'string', 'max:255'],
            'is_primary' => ['sometimes', 'boolean'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }
}
