<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Employees\ApproveEmployeeOnboardingRequest;
use App\Http\Requests\Employees\AcceptEmployeeInvitationRequest;
use App\Http\Requests\Employees\StoreEmployeeRequest;
use App\Http\Requests\Employees\UpdateEmployeeProfileRequest;
use App\Models\Employee;
use App\Http\Resources\EmployeeProfileResource;
use App\Http\Resources\EmployeeResource;
use App\Http\Resources\UserResource;
use App\Services\EmployeeInvitationService;
use App\Services\EmployeeOnboardingService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Symfony\Component\HttpFoundation\StreamedResponse;

class EmployeeController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        abort_unless($request->user()->can('employees.view'), 403);

        $perPage = min(max($request->integer('per_page', 15), 1), 100);

        $employees = $this->employeeQuery($request)
            ->paginate($perPage);

        return EmployeeResource::collection($employees);
    }

    public function export(Request $request): StreamedResponse
    {
        abort_unless($request->user()->can('employees.view'), 403);

        $format = strtolower($request->string('format', 'csv')->toString());

        abort_if($format !== 'csv', 422, 'Only CSV export is supported for now.');

        $filename = 'employees-'.now()->format('Y-m-d-His').'.csv';

        return response()->streamDownload(function () use ($request): void {
            $handle = fopen('php://output', 'w');

            fputcsv($handle, [
                'Employee Number',
                'First Name',
                'Middle Name',
                'Last Name',
                'Work Email',
                'Phone',
                'Status',
                'Department',
                'Unit',
                'Designation',
                'Grade Level',
                'Employment Type',
                'Location',
                'Reporting Manager',
                'Profile Status',
                'Start Date',
                'Invited At',
                'Onboarding Completed At',
                'Activated At',
                'Created At',
            ]);

            $this->employeeQuery($request)->chunk(200, function ($employees) use ($handle): void {
                foreach ($employees as $employee) {
                    fputcsv($handle, [
                        $employee->employee_number,
                        $employee->first_name,
                        $employee->middle_name,
                        $employee->last_name,
                        $employee->work_email,
                        $employee->phone,
                        $employee->status,
                        $employee->department?->name,
                        $employee->unit?->name,
                        $employee->designation?->name,
                        $employee->gradeLevel?->name,
                        $employee->employmentType?->name,
                        $employee->location?->name,
                        $employee->reportingManager
                            ? trim($employee->reportingManager->first_name.' '.$employee->reportingManager->last_name)
                            : null,
                        $employee->profile?->completion_status,
                        $employee->start_date?->toDateString(),
                        $employee->invited_at?->toDateTimeString(),
                        $employee->onboarding_completed_at?->toDateTimeString(),
                        $employee->activated_at?->toDateTimeString(),
                        $employee->created_at?->toDateTimeString(),
                    ]);
                }
            });

            fclose($handle);
        }, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }

    public function store(StoreEmployeeRequest $request, EmployeeOnboardingService $onboarding): JsonResponse
    {
        $result = $onboarding->createEmployee(
            $request->user(),
            $request->safeEmployeeData(),
            $request->boolean('send_invitation')
        );

        return response()->json([
            'employee' => new EmployeeResource($result['employee']),
            'invitation' => $result['invitation'] ? [
                'id' => $result['invitation']->id,
                'email' => $result['invitation']->email,
                'status' => $result['invitation']->status,
                'expires_at' => $result['invitation']->expires_at,
                'token' => $result['invitation_token'],
            ] : null,
        ], 201);
    }

    public function show(Request $request, Employee $employee): EmployeeResource
    {
        abort_unless($request->user()->can('employees.view'), 403, 'You do not have permission to view employees.');

        if ($employee->organization_id !== $request->user()->organization_id) {
            abort(404);
        }

        $employee->load([
            'user',
            'department',
            'unit',
            'designation',
            'gradeLevel',
            'employmentType',
            'location',
            'reportingManager',
            'profile',
            'invitations',
        ]);

        return new EmployeeResource($employee);
    }

    public function acceptInvitation(
        AcceptEmployeeInvitationRequest $request,
        string $token,
        EmployeeInvitationService $invitations
    ): JsonResponse {
        $result = $invitations->accept($token, $request->string('password')->toString());
        $invitation = $result['invitation'];

        return response()->json([
            'token' => $result['token'],
            'token_type' => 'Bearer',
            'user' => new UserResource($invitation->employee->user),
            'employee' => new EmployeeResource($invitation->employee),
            'profile' => new EmployeeProfileResource($invitation->employee->profile),
            'invitation' => [
                'id' => $invitation->id,
                'email' => $invitation->email,
                'status' => $invitation->status,
                'accepted_at' => $invitation->accepted_at,
            ],
        ]);
    }

    public function updateMyProfile(UpdateEmployeeProfileRequest $request): JsonResponse
    {
        $employee = $request->user()->employee()->with('profile')->firstOrFail();
        $profile = $employee->profile()->firstOrCreate([
            'employee_id' => $employee->id,
        ]);

        $profile->update([
            ...$request->validated(),
            'completion_status' => 'submitted',
        ]);

        return response()->json([
            'employee' => new EmployeeResource($employee->refresh()),
            'profile' => new EmployeeProfileResource($profile->refresh()),
        ]);
    }

    public function approveOnboarding(
        ApproveEmployeeOnboardingRequest $request,
        Employee $employee,
        EmployeeOnboardingService $onboarding
    ): JsonResponse {
        if ($employee->organization_id !== $request->user()->organization_id) {
            abort(404);
        }

        $employee = $onboarding->approve($employee);

        return response()->json([
            'employee' => new EmployeeResource($employee),
            'profile' => new EmployeeProfileResource($employee->profile),
        ]);
    }

    /**
     * @param array<int, string> $allowed
     */
    private function allowedValue(string $value, array $allowed, string $fallback): string
    {
        return in_array($value, $allowed, true) ? $value : $fallback;
    }

    /**
     * @return Builder<Employee>
     */
    private function employeeQuery(Request $request): Builder
    {
        $sortBy = $this->allowedValue(
            $request->string('sort_by', 'id')->toString(),
            ['id', 'created_at', 'updated_at', 'start_date', 'invited_at', 'activated_at', 'employee_number', 'first_name', 'last_name'],
            'id'
        );
        $sortDirection = strtolower($request->string('sort_direction', 'desc')->toString()) === 'asc' ? 'asc' : 'desc';
        $dateColumn = $this->allowedValue(
            $request->string('date_column', 'created_at')->toString(),
            ['created_at', 'updated_at', 'start_date', 'invited_at', 'activated_at', 'onboarding_completed_at'],
            'created_at'
        );

        return Employee::query()
            ->with([
                'department',
                'unit',
                'designation',
                'gradeLevel',
                'employmentType',
                'location',
                'reportingManager',
                'profile',
            ])
            ->where('organization_id', $request->user()->organization_id)
            ->when($request->string('search')->toString(), function (Builder $query, string $search): void {
                $query->where(function (Builder $query) use ($search): void {
                    $query
                        ->where('employee_number', 'like', "%{$search}%")
                        ->orWhere('first_name', 'like', "%{$search}%")
                        ->orWhere('last_name', 'like', "%{$search}%")
                        ->orWhere('work_email', 'like', "%{$search}%");
                });
            })
            ->when($request->string('status')->toString(), fn (Builder $query, string $status) => $query->where('status', $status))
            ->when($request->integer('department_id'), fn (Builder $query, int $departmentId) => $query->where('department_id', $departmentId))
            ->when($request->integer('unit_id'), fn (Builder $query, int $unitId) => $query->where('unit_id', $unitId))
            ->when($request->integer('designation_id'), fn (Builder $query, int $designationId) => $query->where('designation_id', $designationId))
            ->when($request->integer('grade_level_id'), fn (Builder $query, int $gradeLevelId) => $query->where('grade_level_id', $gradeLevelId))
            ->when($request->integer('employment_type_id'), fn (Builder $query, int $employmentTypeId) => $query->where('employment_type_id', $employmentTypeId))
            ->when($request->integer('organization_location_id'), fn (Builder $query, int $locationId) => $query->where('organization_location_id', $locationId))
            ->when($request->integer('reporting_manager_id'), fn (Builder $query, int $managerId) => $query->where('reporting_manager_id', $managerId))
            ->when($request->string('profile_status')->toString(), fn (Builder $query, string $status) => $query->whereHas('profile', fn (Builder $query) => $query->where('completion_status', $status)))
            ->when($request->date('date_from'), fn (Builder $query, $date) => $query->whereDate($dateColumn, '>=', $date->toDateString()))
            ->when($request->date('date_to'), fn (Builder $query, $date) => $query->whereDate($dateColumn, '<=', $date->toDateString()))
            ->orderBy($sortBy, $sortDirection);
    }
}
