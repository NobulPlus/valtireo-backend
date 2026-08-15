<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Employee;
use App\Services\EmployeeProfileOverviewService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EmployeeProfileOverviewController extends Controller
{
    public function show(Request $request, Employee $employee, EmployeeProfileOverviewService $profiles): JsonResponse
    {
        abort_unless($employee->organization_id === $request->user()->organization_id, 404);
        abort_unless($request->user()->can('employees.view'), 403);

        return response()->json($profiles->overview($employee));
    }

    public function me(Request $request, EmployeeProfileOverviewService $profiles): JsonResponse
    {
        $employee = $request->user()->employee()->firstOrFail();

        return response()->json($profiles->overview($employee));
    }
}
