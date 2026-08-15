<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Employees\StoreEmployeeReportingHistoryRequest;
use App\Http\Requests\Employees\StoreEmployeeStatusHistoryRequest;
use App\Http\Resources\EmployeeReportingHistoryResource;
use App\Http\Resources\EmployeeStatusHistoryResource;
use App\Models\Employee;
use App\Services\EmployeeLifecycleService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class EmployeeLifecycleController extends Controller
{
    public function statusHistory(Request $request, Employee $employee): AnonymousResourceCollection
    {
        $this->authorizeEmployeeView($request, $employee);

        return EmployeeStatusHistoryResource::collection(
            $employee->statusHistories()
                ->with('changedBy')
                ->latest('effective_date')
                ->latest('id')
                ->get()
        );
    }

    public function storeStatusHistory(
        StoreEmployeeStatusHistoryRequest $request,
        Employee $employee,
        EmployeeLifecycleService $lifecycle
    ): JsonResponse {
        $history = $lifecycle->changeStatus($request->user(), $employee, $request->validated());

        return response()->json([
            'status_history' => new EmployeeStatusHistoryResource($history),
        ], 201);
    }

    public function reportingHistory(Request $request, Employee $employee): AnonymousResourceCollection
    {
        $this->authorizeEmployeeView($request, $employee);

        return EmployeeReportingHistoryResource::collection(
            $employee->reportingHistories()
                ->with(['previousManager', 'newManager', 'changedBy'])
                ->latest('effective_date')
                ->latest('id')
                ->get()
        );
    }

    public function storeReportingHistory(
        StoreEmployeeReportingHistoryRequest $request,
        Employee $employee,
        EmployeeLifecycleService $lifecycle
    ): JsonResponse {
        $history = $lifecycle->changeReportingManager($request->user(), $employee, $request->validated());

        return response()->json([
            'reporting_history' => new EmployeeReportingHistoryResource($history),
        ], 201);
    }

    private function authorizeEmployeeView(Request $request, Employee $employee): void
    {
        abort_unless($request->user()->can('employees.view'), 403);
        abort_unless($employee->organization_id === $request->user()->organization_id, 404);
    }
}
