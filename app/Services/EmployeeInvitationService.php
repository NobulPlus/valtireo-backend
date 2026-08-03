<?php

namespace App\Services;

use App\Models\EmployeeInvitation;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class EmployeeInvitationService
{
    /**
     * @return array{invitation: EmployeeInvitation, token: string}
     */
    public function accept(string $plainToken, string $password): array
    {
        return DB::transaction(function () use ($plainToken, $password): array {
            $invitation = EmployeeInvitation::query()
                ->with('employee.user')
                ->where('token_hash', hash('sha256', $plainToken))
                ->first();

            if (! $invitation) {
                throw ValidationException::withMessages([
                    'token' => ['This invitation is invalid.'],
                ]);
            }

            if ($invitation->status !== 'pending') {
                throw ValidationException::withMessages([
                    'token' => ['This invitation has already been used.'],
                ]);
            }

            if ($invitation->expires_at && $invitation->expires_at->isPast()) {
                $invitation->update(['status' => 'expired']);

                throw ValidationException::withMessages([
                    'token' => ['This invitation has expired.'],
                ]);
            }

            $employee = $invitation->employee;
            $user = $employee->user;

            if (! $user) {
                throw ValidationException::withMessages([
                    'token' => ['This invitation is not linked to a user account.'],
                ]);
            }

            $user->update([
                'password' => $password,
            ]);

            $invitation->update([
                'status' => 'accepted',
                'accepted_at' => now(),
            ]);

            $employee->update([
                'status' => 'onboarding',
            ]);

            return [
                'invitation' => $invitation->refresh(),
                'token' => $user->createToken('employee-invitation')->plainTextToken,
            ];
        });
    }
}
