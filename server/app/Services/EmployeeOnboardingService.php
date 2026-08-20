<?php

namespace App\Services;

use App\Models\Employee;
use App\Models\EmployeeInvitation;
use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class EmployeeOnboardingService
{
    public function __construct(
        private readonly NotificationDispatchService $notifications,
        private readonly EmployeeRoleAssignmentService $roleAssignment,
        private readonly LeaveEntitlementProvisioningService $leaveEntitlements,
        private readonly EmployeeProfileActivityService $activities,
    ) {
    }

    /**
     * @param array<string, mixed> $data
     *
     * @return array{employee: Employee, invitation: EmployeeInvitation|null, invitation_token: string|null}
     */
    public function createEmployee(User $actor, array $data, bool $sendInvitation): array
    {
        if (! empty($data['pending_role_id'])) {
            $role = Role::query()->where('organization_id', $actor->organization_id)->findOrFail($data['pending_role_id']);
            $this->roleAssignment->assertCanAssign($actor, $role);
        }

        return DB::transaction(function () use ($actor, $data, $sendInvitation): array {
            $employee = Employee::query()->create([
                ...$data,
                'organization_id' => $actor->organization_id,
                'status' => $sendInvitation ? 'invited' : 'draft',
                'invited_at' => $sendInvitation ? now() : null,
            ]);

            $employee->profile()->create([
                'completion_status' => 'pending',
            ]);

            $invitation = null;
            $plainToken = null;

            if ($sendInvitation) {
                ['invitation' => $invitation, 'token' => $plainToken] = $this->inviteExistingEmployee($actor, $employee);
            }

            return [
                'employee' => $employee->refresh(),
                'invitation' => $invitation,
                'invitation_token' => $plainToken,
            ];
        });
    }

    /**
     * @return array{invitation: EmployeeInvitation, token: string}
     */
    public function inviteExistingEmployee(User $actor, Employee $employee): array
    {
        if ($employee->organization_id !== $actor->organization_id) {
            abort(404);
        }

        if (! filled($employee->work_email)) {
            throw ValidationException::withMessages([
                'new_status' => ['This employee must have a work email before an invitation can be sent.'],
            ]);
        }

        $existingUser = User::query()->where('email', $employee->work_email)->first();

        if ($existingUser && $existingUser->organization_id !== $actor->organization_id) {
            throw ValidationException::withMessages([
                'new_status' => ['This employee email already belongs to another organization.'],
            ]);
        }

        $user = User::query()->firstOrCreate(
            ['email' => $employee->work_email],
            [
                'organization_id' => $actor->organization_id,
                'name' => trim($employee->first_name.' '.$employee->last_name),
                'password' => Str::password(32),
            ]
        );

        $user->update([
            'organization_id' => $actor->organization_id,
            'name' => trim($employee->first_name.' '.$employee->last_name),
        ]);

        $this->roleAssignment->applyRoleSelection($actor, $employee, $user);

        $employee->update([
            'user_id' => $user->id,
            'invited_at' => now(),
        ]);

        $plainToken = Str::random(64);
        $invitation = $employee->invitations()->create([
            'organization_id' => $actor->organization_id,
            'invited_by_user_id' => $actor->id,
            'email' => $employee->work_email,
            'token_hash' => hash('sha256', $plainToken),
            'status' => 'pending',
            'expires_at' => now()->addDays(7),
        ]);

        $this->notifications->employeeInvited($invitation, $plainToken);

        return [
            'invitation' => $invitation,
            'token' => $plainToken,
        ];
    }

    /**
     * @param array<string, mixed> $data
     */
    public function approve(Employee $employee, User $actor, array $data): Employee
    {
        return DB::transaction(function () use ($employee, $actor, $data): Employee {
            $employee->loadMissing('profile');

            if ($employee->status !== 'onboarding') {
                throw ValidationException::withMessages([
                    'employee' => ['This employee is not currently in onboarding.'],
                ]);
            }

            if (! $employee->profile || ! in_array($employee->profile->completion_status, ['submitted', 'approved'], true)) {
                throw ValidationException::withMessages([
                    'employee' => ['This employee profile is not ready for onboarding approval.'],
                ]);
            }

            $now = now();
            $newStatus = $data['new_status'];

            $employee->profile->update([
                'completion_status' => 'approved',
            ]);

            $employee->update([
                'status' => $newStatus,
                'onboarding_completed_at' => $now,
                'activated_at' => $now,
                'probation_ends_at' => $newStatus === 'probation' ? $data['probation_ends_at'] : null,
            ]);

            $history = $employee->statusHistories()->create([
                'organization_id' => $employee->organization_id,
                'changed_by_id' => $actor->id,
                'previous_status' => 'onboarding',
                'new_status' => $newStatus,
                'effective_date' => $now->toDateString(),
                'reason' => 'Onboarding approved.',
            ]);

            $this->activities->record(
                $employee,
                $actor,
                'status_changed',
                'Employment status changed',
                "Onboarding approved — status changed from onboarding to {$newStatus}.",
                $history,
                [
                    'previous_status' => 'onboarding',
                    'new_status' => $newStatus,
                    'effective_date' => $now->toDateString(),
                ]
            );

            $this->leaveEntitlements->grantDefaultsForActivation($employee);

            return $employee->refresh()->load('profile');
        });
    }
}
