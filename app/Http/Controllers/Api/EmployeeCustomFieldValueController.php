<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Employees\UpsertEmployeeCustomFieldValuesRequest;
use App\Http\Resources\EmployeeCustomFieldValueResource;
use App\Models\Employee;
use App\Services\EmployeeCustomFieldService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class EmployeeCustomFieldValueController extends Controller
{
    public function index(Request $request, Employee $employee): AnonymousResourceCollection
    {
        $this->authorizeEmployee($request, $employee, 'employees.view');

        return EmployeeCustomFieldValueResource::collection(
            $employee->customFieldValues()->with(['field', 'updatedBy'])->get()
        );
    }

    public function upsert(
        UpsertEmployeeCustomFieldValuesRequest $request,
        Employee $employee,
        EmployeeCustomFieldService $customFields
    ): JsonResponse {
        $this->authorizeEmployee($request, $employee, 'employees.update');

        $values = $customFields->upsertValues($request->user(), $employee, $request->validated('values'));

        return response()->json([
            'custom_field_values' => EmployeeCustomFieldValueResource::collection($values),
        ]);
    }

    public function myIndex(Request $request): AnonymousResourceCollection
    {
        $employee = $request->user()->employee()->firstOrFail();

        return EmployeeCustomFieldValueResource::collection(
            $employee->customFieldValues()
                ->whereHas('field', fn (Builder $query) => $query->where('visible_to_employee', true)->where('is_active', true))
                ->with(['field', 'updatedBy'])
                ->get()
        );
    }

    public function myUpsert(
        UpsertEmployeeCustomFieldValuesRequest $request,
        EmployeeCustomFieldService $customFields
    ): JsonResponse {
        $employee = $request->user()->employee()->firstOrFail();

        $values = $customFields->upsertValues($request->user(), $employee, $request->validated('values'), selfService: true);

        return response()->json([
            'custom_field_values' => EmployeeCustomFieldValueResource::collection($values),
        ]);
    }

    private function authorizeEmployee(Request $request, Employee $employee, string $permission): void
    {
        abort_unless($employee->organization_id === $request->user()->organization_id, 404);
        abort_unless($request->user()->can($permission), 403);
    }
}
