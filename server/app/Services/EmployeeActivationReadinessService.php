<?php

namespace App\Services;

use App\Models\Employee;
use Illuminate\Validation\ValidationException;

class EmployeeActivationReadinessService
{
    private const REQUIRED_BIODATA_FIELDS = [
        'date_of_birth' => 'Date of birth',
        'gender' => 'Gender',
        'residential_address' => 'Residential address',
        'next_of_kin_name' => 'Next of kin name',
        'next_of_kin_phone' => 'Next of kin phone',
    ];

    public function ensureReady(Employee $employee, string $errorKey = 'new_status'): void
    {
        $employee->loadMissing('profile');
        $profile = $employee->profile;
        $missing = [];

        foreach (self::REQUIRED_BIODATA_FIELDS as $field => $label) {
            if (! $profile || blank($profile->{$field})) {
                $missing[] = $label;
            }
        }

        if ($employee->emergencyContacts()->doesntExist()) {
            $missing[] = 'Emergency contact';
        }

        if ($missing === []) {
            return;
        }

        $message = count($missing) <= 3
            ? 'Cannot activate employee. Missing biodata: '.implode(', ', $missing).'.'
            : 'Cannot activate employee. Important biodata is missing. Review the employee biodata before activation.';

        throw ValidationException::withMessages([
            $errorKey => [$message],
        ]);
    }
}
