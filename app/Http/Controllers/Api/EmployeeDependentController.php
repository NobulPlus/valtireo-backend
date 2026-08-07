<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Employees\StoreEmployeeDependentRequest;
use App\Http\Requests\Employees\UpdateEmployeeDependentRequest;
use App\Http\Resources\EmployeeDependentResource;
use App\Models\Employee;
use App\Models\EmployeeDependent;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class EmployeeDependentController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $employee = $this->targetEmployee($request, $request->integer('employee_id') ?: null, 'employees.view');

        return EmployeeDependentResource::collection(
            $employee->dependents()->orderByDesc('is_beneficiary')->orderBy('name')->get()
        );
    }

    public function store(StoreEmployeeDependentRequest $request): JsonResponse
    {
        $employee = $this->targetEmployee($request, $request->integer('employee_id') ?: null, 'employees.update');

        $dependent = $employee->dependents()->create([
            'organization_id' => $request->user()->organization_id,
            ...$request->safe()->except('employee_id'),
        ]);

        return response()->json([
            'dependent' => new EmployeeDependentResource($dependent),
        ], 201);
    }

    public function update(UpdateEmployeeDependentRequest $request, EmployeeDependent $dependent): JsonResponse
    {
        $this->authorizeRecord($request, $dependent);

        $dependent->update($request->validated());

        return response()->json([
            'dependent' => new EmployeeDependentResource($dependent->refresh()),
        ]);
    }

    public function destroy(Request $request, EmployeeDependent $dependent): JsonResponse
    {
        $this->authorizeRecord($request, $dependent);

        $dependent->delete();

        return response()->json([
            'message' => 'Dependent deleted successfully.',
        ]);
    }

    private function targetEmployee(Request $request, ?int $employeeId, string $permission): Employee
    {
        if ($request->user()->can($permission) && $employeeId) {
            return Employee::query()
                ->where('organization_id', $request->user()->organization_id)
                ->findOrFail($employeeId);
        }

        return $request->user()->employee()->firstOrFail();
    }

    private function authorizeRecord(Request $request, EmployeeDependent $dependent): void
    {
        abort_unless($dependent->organization_id === $request->user()->organization_id, 404);

        if ($request->user()->can('employees.update')) {
            return;
        }

        abort_unless($request->user()->employee?->id === $dependent->employee_id, 403);
    }
}
