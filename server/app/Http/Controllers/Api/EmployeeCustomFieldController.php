<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Employees\StoreEmployeeCustomFieldRequest;
use App\Http\Requests\Employees\UpdateEmployeeCustomFieldRequest;
use App\Http\Resources\EmployeeCustomFieldResource;
use App\Models\EmployeeCustomField;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class EmployeeCustomFieldController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $canManage = $request->user()->can('employees.view');

        $fields = EmployeeCustomField::query()
            ->where('organization_id', $request->user()->organization_id)
            ->when(! $canManage, fn (Builder $query) => $query->where('visible_to_employee', true)->where('is_active', true))
            ->when($request->has('is_active'), fn (Builder $query) => $query->where('is_active', $request->boolean('is_active')))
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        return EmployeeCustomFieldResource::collection($fields);
    }

    public function store(StoreEmployeeCustomFieldRequest $request): JsonResponse
    {
        $field = EmployeeCustomField::query()->create([
            'organization_id' => $request->user()->organization_id,
            ...$request->validated(),
        ]);

        return response()->json([
            'custom_field' => new EmployeeCustomFieldResource($field),
        ], 201);
    }

    public function show(Request $request, EmployeeCustomField $customField): EmployeeCustomFieldResource
    {
        $this->authorizeField($request, $customField, 'employees.view');

        return new EmployeeCustomFieldResource($customField);
    }

    public function update(UpdateEmployeeCustomFieldRequest $request, EmployeeCustomField $customField): JsonResponse
    {
        $this->authorizeField($request, $customField, 'employees.update');

        $customField->update($request->validated());

        return response()->json([
            'custom_field' => new EmployeeCustomFieldResource($customField->refresh()),
        ]);
    }

    private function authorizeField(Request $request, EmployeeCustomField $customField, string $permission): void
    {
        abort_unless($customField->organization_id === $request->user()->organization_id, 404);

        if ($request->user()->can($permission)) {
            return;
        }

        abort_unless($customField->visible_to_employee && $customField->is_active, 403);
    }
}
