<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Employees\StoreEmployeeEmergencyContactRequest;
use App\Http\Requests\Employees\UpdateEmployeeEmergencyContactRequest;
use App\Http\Resources\EmployeeEmergencyContactResource;
use App\Models\Employee;
use App\Models\EmployeeEmergencyContact;
use App\Services\EmployeeProfileActivityService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class EmployeeEmergencyContactController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $employee = $this->targetEmployee($request, $request->integer('employee_id') ?: null, 'employees.view');

        return EmployeeEmergencyContactResource::collection(
            $employee->emergencyContacts()->orderByDesc('is_primary')->orderBy('name')->get()
        );
    }

    public function store(StoreEmployeeEmergencyContactRequest $request, EmployeeProfileActivityService $activities): JsonResponse
    {
        $employee = $this->targetEmployee($request, $request->integer('employee_id') ?: null, 'employees.update');

        if ($request->boolean('is_primary')) {
            $employee->emergencyContacts()->update(['is_primary' => false]);
        }

        $contact = $employee->emergencyContacts()->create([
            'organization_id' => $request->user()->organization_id,
            ...$request->safe()->except('employee_id'),
        ]);

        $activities->record($employee, $request->user(), 'emergency_contact_created', 'Emergency contact added', "{$contact->name} was added as an emergency contact.", $contact);

        return response()->json([
            'emergency_contact' => new EmployeeEmergencyContactResource($contact),
        ], 201);
    }

    public function update(UpdateEmployeeEmergencyContactRequest $request, EmployeeEmergencyContact $emergencyContact, EmployeeProfileActivityService $activities): JsonResponse
    {
        $this->authorizeRecord($request, $emergencyContact);

        if ($request->boolean('is_primary')) {
            $emergencyContact->employee->emergencyContacts()
                ->whereKeyNot($emergencyContact->id)
                ->update(['is_primary' => false]);
        }

        $emergencyContact->update($request->validated());

        $activities->record($emergencyContact->employee, $request->user(), 'emergency_contact_updated', 'Emergency contact updated', "{$emergencyContact->name} was updated.", $emergencyContact);

        return response()->json([
            'emergency_contact' => new EmployeeEmergencyContactResource($emergencyContact->refresh()),
        ]);
    }

    public function destroy(Request $request, EmployeeEmergencyContact $emergencyContact, EmployeeProfileActivityService $activities): JsonResponse
    {
        $this->authorizeRecord($request, $emergencyContact);

        $activities->record($emergencyContact->employee, $request->user(), 'emergency_contact_deleted', 'Emergency contact deleted', "{$emergencyContact->name} was deleted.", $emergencyContact);

        $emergencyContact->delete();

        return response()->json([
            'message' => 'Emergency contact deleted successfully.',
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

    private function authorizeRecord(Request $request, EmployeeEmergencyContact $emergencyContact): void
    {
        abort_unless($emergencyContact->organization_id === $request->user()->organization_id, 404);

        if ($request->user()->can('employees.update')) {
            return;
        }

        abort_unless($request->user()->employee?->id === $emergencyContact->employee_id, 403);
    }
}
