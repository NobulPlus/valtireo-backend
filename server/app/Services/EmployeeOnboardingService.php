<?php

namespace App\Services;

use App\Models\Employee;
use App\Models\EmployeeInvitation;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class EmployeeOnboardingService
{
    public function __construct(private readonly NotificationDispatchService $notifications)
    {
    }

    /**
     * @param array<string, mixed> $data
     *
     * @return array{employee: Employee, invitation: EmployeeInvitation|null, invitation_token: string|null}
     */
    public function createEmployee(User $actor, array $data, bool $sendInvitation): array
    {
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

        $user->assignRole('Employee');

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

    public function approve(Employee $employee): Employee
    {
        return DB::transaction(function () use ($employee): Employee {
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

            $employee->profile->update([
                'completion_status' => 'approved',
            ]);

            $employee->update([
                'status' => 'active',
                'onboarding_completed_at' => $now,
                'activated_at' => $now,
            ]);

            return $employee->refresh()->load('profile');
        });
    }
}
