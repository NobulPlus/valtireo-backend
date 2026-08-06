<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Department;
use App\Models\Designation;
use App\Models\EmploymentType;
use App\Models\GradeLevel;
use App\Models\OrganizationLocation;
use App\Models\Unit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SetupLookupController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        return response()->json([
            'departments' => $this->departments($request)->getData(true)['data'],
            'units' => $this->units($request)->getData(true)['data'],
            'designations' => $this->designations($request)->getData(true)['data'],
            'grade_levels' => $this->gradeLevels($request)->getData(true)['data'],
            'employment_types' => $this->employmentTypes($request)->getData(true)['data'],
            'locations' => $this->locations($request)->getData(true)['data'],
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
}
