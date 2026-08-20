<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Employees\ApproveEmployeeOnboardingRequest;
use App\Http\Requests\Employees\AcceptEmployeeInvitationRequest;
use App\Http\Requests\Employees\StoreEmployeeRequest;
use App\Http\Requests\Employees\UpdateEmployeeProfileRequest;
use App\Models\Employee;
use App\Models\Role;
use App\Http\Resources\EmployeeProfileResource;
use App\Http\Resources\EmployeeResource;
use App\Http\Resources\UserResource;
use App\Services\EmployeeInvitationService;
use App\Services\EmployeeOnboardingService;
use App\Services\EmployeeProfileActivityService;
use App\Services\EmployeeRoleAssignmentService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
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
            'emergencyContacts',
            'dependents',
            'documents.documentType',
            'documents.requirement',
            'customFieldValues.field',
            'customFieldValues.updatedBy',
            'statusHistories.changedBy',
            'reportingHistories.previousManager',
            'reportingHistories.newManager',
            'reportingHistories.changedBy',
            'profileActivities.actor',
        ]);

        return new EmployeeResource($employee);
    }

    public function update(Request $request, Employee $employee, EmployeeRoleAssignmentService $roleAssignment): EmployeeResource
    {
        abort_unless($request->user()->can('employees.update'), 403, 'You do not have permission to update employees.');
        abort_unless($employee->organization_id === $request->user()->organization_id, 404);

        if ($request->has('pending_role_id')) {
            abort_unless($request->user()->can('employees.assign_role'), 403, 'You do not have permission to change an employee\'s system role.');
        }

        $organizationId = $request->user()->organization_id;
        $data = $request->validate([
            'first_name' => ['sometimes', 'string', 'max:255'],
            'middle_name' => ['nullable', 'string', 'max:255'],
            'last_name' => ['sometimes', 'string', 'max:255'],
            'work_email' => [
                'sometimes',
                'email',
                'max:255',
                Rule::unique('employees', 'work_email')->where('organization_id', $organizationId)->ignore($employee->id),
            ],
            'phone' => ['nullable', 'string', 'max:50'],
            'department_id' => ['nullable', Rule::exists('departments', 'id')->where('organization_id', $organizationId)],
            'unit_id' => ['nullable', Rule::exists('units', 'id')->where('organization_id', $organizationId)],
            'designation_id' => ['nullable', Rule::exists('designations', 'id')->where('organization_id', $organizationId)],
            'employment_type_id' => ['nullable', Rule::exists('employment_types', 'id')->where('organization_id', $organizationId)],
            'organization_location_id' => ['nullable', Rule::exists('organization_locations', 'id')->where('organization_id', $organizationId)],
            'start_date' => ['nullable', 'date'],
            'pending_role_id' => ['sometimes', 'nullable', Rule::exists('roles', 'id')->where('organization_id', $organizationId)],
            'profile' => ['sometimes', 'array'],
            'profile.date_of_birth' => ['nullable', 'date', 'before:today'],
            'profile.gender' => ['nullable', 'string', 'max:50'],
            'profile.personal_email' => ['nullable', 'email', 'max:255'],
            'profile.residential_address' => ['nullable', 'string', 'max:1000'],
            'profile.next_of_kin_name' => ['nullable', 'string', 'max:255'],
            'profile.next_of_kin_phone' => ['nullable', 'string', 'max:50'],
            'profile.emergency_contact_name' => ['nullable', 'string', 'max:255'],
            'profile.emergency_contact_phone' => ['nullable', 'string', 'max:50'],
        ]);

        $profileData = $data['profile'] ?? null;
        unset($data['profile']);

        $pendingRoleIdRequested = array_key_exists('pending_role_id', $data);
        $pendingRoleId = $data['pending_role_id'] ?? null;
        unset($data['pending_role_id']);

        $employee->update($data);

        if ($pendingRoleIdRequested && $pendingRoleId !== null) {
            if ($employee->user) {
                $roleAssignment->updateAssignedRole($request->user(), $employee, $employee->user, $pendingRoleId);
            } else {
                $role = Role::query()->where('organization_id', $organizationId)->findOrFail($pendingRoleId);
                $roleAssignment->assertCanAssign($request->user(), $role);
                $employee->update(['pending_role_id' => $pendingRoleId]);
            }
        }

        if (is_array($profileData)) {
            $employee->profile()->updateOrCreate(
                ['employee_id' => $employee->id],
                $profileData
            );
        }

        return new EmployeeResource($this->loadEmployeeDetail($employee->refresh()));
    }

    public function exportOne(Request $request, Employee $employee): StreamedResponse
    {
        abort_unless($request->user()->can('employees.view'), 403);
        abort_unless($employee->organization_id === $request->user()->organization_id, 404);

        $employee = $this->loadEmployeeDetail($employee);
        $filename = strtolower($employee->employee_number).'-profile-'.now()->format('Y-m-d').'.csv';

        return response()->streamDownload(function () use ($employee): void {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, ['Field', 'Value']);
            fputcsv($handle, ['Employee Number', $employee->employee_number]);
            fputcsv($handle, ['Full Name', trim($employee->first_name.' '.$employee->last_name)]);
            fputcsv($handle, ['Work Email', $employee->work_email]);
            fputcsv($handle, ['Phone', $employee->phone]);
            fputcsv($handle, ['Status', $employee->status]);
            fputcsv($handle, ['Department', $employee->department?->name]);
            fputcsv($handle, ['Unit', $employee->unit?->name]);
            fputcsv($handle, ['Designation', $employee->designation?->name]);
            fputcsv($handle, ['Employment Type', $employee->employmentType?->name]);
            fputcsv($handle, ['Location', $employee->location?->name]);
            fputcsv($handle, ['Reporting Manager', $employee->reportingManager ? trim($employee->reportingManager->first_name.' '.$employee->reportingManager->last_name) : null]);
            fputcsv($handle, ['Start Date', $employee->start_date?->toDateString()]);
            fputcsv($handle, ['Profile Status', $employee->profile?->completion_status]);
            fclose($handle);
        }, $filename, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    public function requestCorrection(Request $request, Employee $employee, EmployeeProfileActivityService $activities): JsonResponse
    {
        abort_unless($request->user()->can('employees.update'), 403);
        abort_unless($employee->organization_id === $request->user()->organization_id, 404);

        $data = $request->validate([
            'section' => ['required', 'string', 'max:100'],
            'message' => ['required', 'string', 'max:2000'],
        ]);

        $activity = $activities->record(
            $employee,
            $request->user(),
            'correction_requested',
            'Profile correction requested',
            $data['message'],
            null,
            ['section' => $data['section']]
        );

        return response()->json(['activity' => $activity], 201);
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

    private function loadEmployeeDetail(Employee $employee): Employee
    {
        return $employee->load([
            'user.roles',
            'department',
            'unit',
            'designation',
            'gradeLevel',
            'employmentType',
            'location',
            'reportingManager',
            'profile',
            'invitations',
            'emergencyContacts',
            'dependents',
            'documents.documentType',
            'documents.requirement',
            'customFieldValues.field',
            'customFieldValues.updatedBy',
            'statusHistories.changedBy',
            'reportingHistories.previousManager',
            'reportingHistories.newManager',
            'reportingHistories.changedBy',
            'profileActivities.actor',
        ]);
    }

    public function updateMyProfile(UpdateEmployeeProfileRequest $request, EmployeeProfileActivityService $activities): JsonResponse
    {
        $employee = $request->user()->employee()->with('profile')->firstOrFail();
        $profile = $employee->profile()->firstOrCreate([
            'employee_id' => $employee->id,
        ]);

        $data = $request->safe()->except('passport_photo');

        if ($request->hasFile('passport_photo')) {
            if ($profile->passport_photo_path) {
                Storage::disk('public')->delete($profile->passport_photo_path);
            }

            $data['passport_photo_path'] = $request->file('passport_photo')->store(
                "organizations/{$employee->organization_id}/employees/{$employee->id}/passport",
                'public'
            );
        }

        $profile->update([
            ...$data,
            'completion_status' => 'submitted',
        ]);

        $activities->record($employee, $request->user(), 'profile_updated', 'Profile information updated', 'Employee submitted profile information.', $profile);

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

        $employee = $onboarding->approve($employee, $request->user(), $request->validated());

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
                'user.roles',
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
            ->when($request->boolean('manager_roles_only'), function (Builder $query): void {
                $query->whereHas('user', fn (Builder $query) => $query->permission(['employees.view_team', 'employees.view_department']));
            })
            ->when($request->string('profile_status')->toString(), fn (Builder $query, string $status) => $query->whereHas('profile', fn (Builder $query) => $query->where('completion_status', $status)))
            ->when($request->date('date_from'), fn (Builder $query, $date) => $query->whereDate($dateColumn, '>=', $date->toDateString()))
            ->when($request->date('date_to'), fn (Builder $query, $date) => $query->whereDate($dateColumn, '<=', $date->toDateString()))
            ->orderBy($sortBy, $sortDirection);
    }
}
