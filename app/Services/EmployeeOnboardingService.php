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
                $existingUser = User::query()->where('email', $employee->work_email)->first();

                if ($existingUser && $existingUser->organization_id !== $actor->organization_id) {
                    throw ValidationException::withMessages([
                        'work_email' => ['This email already belongs to another organization.'],
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
                ]);

                $user->assignRole('Employee');

                $employee->update([
                    'user_id' => $user->id,
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
            }

            return [
                'employee' => $employee->refresh(),
                'invitation' => $invitation,
                'invitation_token' => $plainToken,
            ];
        });
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

            if (! $employee->profile || $employee->profile->completion_status !== 'submitted') {
                throw ValidationException::withMessages([
                    'employee' => ['This employee has not submitted onboarding details.'],
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
