<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Employees\AcceptEmployeeInvitationRequest;
use App\Http\Requests\Employees\StoreEmployeeRequest;
use App\Http\Requests\Employees\UpdateEmployeeProfileRequest;
use App\Http\Resources\EmployeeProfileResource;
use App\Http\Resources\EmployeeResource;
use App\Http\Resources\UserResource;
use App\Services\EmployeeInvitationService;
use App\Services\EmployeeOnboardingService;
use Illuminate\Http\JsonResponse;

class EmployeeController extends Controller
{
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
}
