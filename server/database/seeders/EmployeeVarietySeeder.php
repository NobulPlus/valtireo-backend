<?php

namespace Database\Seeders;

use App\Models\Department;
use App\Models\Designation;
use App\Models\Employee;
use App\Models\EmployeeStatusHistory;
use App\Models\EmploymentType;
use App\Models\GradeLevel;
use App\Models\Organization;
use App\Models\OrganizationLocation;
use App\Models\Unit;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;

class EmployeeVarietySeeder extends Seeder
{
    /**
     * Add a broad spread of Valtireo employees across hire years, statuses,
     * employment types, and locations, so dashboards, trend charts, and
     * reports have real variety to render instead of a handful of records.
     */
    public function run(): void
    {
        $organization = Organization::query()->where('code', 'VALTIREO')->firstOrFail();
        $admin = User::query()->where('email', 'admin@valtireo.test')->first();

        $departments = Department::query()->whereBelongsTo($organization)->get()->keyBy('code');
        $units = Unit::query()->whereBelongsTo($organization)->get()->keyBy('code');
        $designations = Designation::query()->whereBelongsTo($organization)->get()->keyBy('code');
        $gradeLevels = GradeLevel::query()->whereBelongsTo($organization)->get()->keyBy('code');
        $employmentTypes = EmploymentType::query()->whereBelongsTo($organization)->get()->keyBy('code');
        $locations = OrganizationLocation::query()->whereBelongsTo($organization)->get()->keyBy('code');

        $departmentUnits = [
            'HR' => ['HR-REC', 'HR-ROB'],
            'FIN' => ['FIN-PAY', 'FIN-BUD'],
            'OPS' => ['OPS-FLD', 'OPS-PV', 'OPS-DEP'],
            'ICT' => ['ICT-SYS', 'ICT-SUP'],
            'CMP' => ['CMP-AUD', 'CMP-POL'],
        ];
        $departmentCodes = array_keys($departmentUnits);
        $employmentTypeCodes = ['PERM', 'CONT', 'TEMP', 'INT', 'CONS'];
        $locationCodes = ['HQ', 'IKEJA', 'LEKKI', 'ABJ'];
        $statuses = ['active', 'onboarding', 'invited', 'draft', 'suspended', 'exited'];
        $futureEligibleStatuses = ['draft', 'invited'];

        $firstNames = [
            'Chidinma', 'Emeka', 'Ngozi', 'Ibrahim', 'Tunde', 'Blessing', 'Yusuf', 'Amaka', 'Chike', 'Halima',
            'Segun', 'Uche', 'Grace', 'Musa', 'Abiodun', 'Chinwe', 'Rasheed', 'Funke', 'Obinna', 'Zainab',
            'Kayode', 'Adaeze', 'Suleiman', 'Ifeoma', 'Tobiloba', 'Maryam', 'Ekene', 'Folake', 'Nnamdi', 'Aisha',
            'Chukwuemeka', 'Ronke', 'Bashir', 'Nkechi', 'Damilola', 'Hauwa', 'Olumide', 'Chiamaka', 'Kunle', 'Zara',
        ];
        $lastNames = [
            'Balogun', 'Chukwu', 'Okoro', 'Abubakar', 'Adewale', 'Nwachukwu', 'Eze', 'Bello', 'Adekunle', 'Onyekwere',
            'Okonkwo', 'Yakubu', 'Afolabi', 'Uzoma', 'Danjuma', 'Ogunleye', 'Ibekwe', 'Garba', 'Anyanwu', 'Mustapha',
            'Olawale', 'Chukwuma', 'Aliyu', 'Nnaji',
        ];
        $streets = [
            '12 Bourdillon Road, Ikoyi, Lagos',
            '45 Awolowo Road, Ikeja GRA, Lagos',
            '3 Freedom Way, Lekki Phase 1, Lagos',
            '21 Opebi Road, Ikeja, Lagos',
            '2 Marina Road, Lagos Island, Lagos',
            '9 Adetokunbo Ademola Crescent, Wuse II, Abuja',
            '17 Aminu Kano Crescent, Wuse, Abuja',
            '6 T.Y. Danjuma Street, Asokoro, Abuja',
        ];

        $now = CarbonImmutable::now();
        $usedEmails = [];

        foreach (range(1, 40) as $n) {
            $firstName = $firstNames[($n * 3) % count($firstNames)];
            $lastName = $lastNames[($n * 7 + 1) % count($lastNames)];
            $gender = $n % 2 === 0 ? 'female' : 'male';

            $emailBase = strtolower($firstName.'.'.$lastName);
            $email = $emailBase.'@valtireo.test';
            $suffix = 2;
            while (in_array($email, $usedEmails, true)) {
                $email = $emailBase.$suffix.'@valtireo.test';
                $suffix++;
            }
            $usedEmails[] = $email;

            $departmentCode = $departmentCodes[$n % count($departmentCodes)];
            $unitCode = $departmentUnits[$departmentCode][$n % count($departmentUnits[$departmentCode])];
            $employmentTypeCode = $employmentTypeCodes[$n % count($employmentTypeCodes)];
            $locationCode = $locationCodes[$n % count($locationCodes)];
            $status = $statuses[$n % count($statuses)];
            $designationCode = $n % 13 === 0 ? 'DH' : ($n % 9 === 0 ? 'SUP' : 'OFF');
            $gradeLevelCode = sprintf('GL%02d', (($n * 2) % 6) + 1);

            // Statuses that imply the person has already been through onboarding
            // can't have a future start date, so keep those years in the past.
            $yearPool = in_array($status, $futureEligibleStatuses, true)
                ? [2022, 2023, 2024, 2025, 2026]
                : [2022, 2023, 2024, 2025];
            $year = $yearPool[$n % count($yearPool)];
            $month = (($n * 5) % 12) + 1;
            $day = (($n * 11) % 27) + 1;
            $startDate = CarbonImmutable::create($year, $month, $day);

            $createdAt = min($startDate->subDays($n % 10), $now);
            $invitedAt = null;
            $activatedAt = null;

            if ($status !== 'draft') {
                $invitedAt = min($createdAt->addDays(1 + ($n % 5)), $now);
            }

            if (in_array($status, ['active', 'suspended', 'exited'], true) && $invitedAt) {
                $activatedAt = min($invitedAt->addDays(3 + ($n % 14)), $now);
            }

            $profileStatus = match ($status) {
                'draft', 'invited' => 'pending',
                'onboarding' => $n % 4 === 0 ? 'changes_requested' : 'submitted',
                default => 'approved',
            };

            $employeeNumber = sprintf('EMP-VAR-%03d', $n);

            $employee = Employee::query()->firstOrCreate(
                [
                    'organization_id' => $organization->id,
                    'employee_number' => $employeeNumber,
                ],
                [
                    'user_id' => null,
                    'first_name' => $firstName,
                    'middle_name' => null,
                    'last_name' => $lastName,
                    'work_email' => $email,
                    'phone' => '0805'.str_pad((string) $n, 7, '0', STR_PAD_LEFT),
                    'department_id' => $departments[$departmentCode]->id,
                    'unit_id' => $units[$unitCode]->id,
                    'designation_id' => $designations[$designationCode]->id,
                    'grade_level_id' => $gradeLevels[$gradeLevelCode]->id,
                    'employment_type_id' => $employmentTypes[$employmentTypeCode]->id,
                    'organization_location_id' => $locations[$locationCode]->id,
                    'reporting_manager_id' => null,
                    'start_date' => $startDate->toDateString(),
                    'status' => $status,
                    'invited_at' => $invitedAt,
                    'activated_at' => $activatedAt,
                ]
            );

            if (! $employee->wasRecentlyCreated) {
                continue;
            }

            // created_at/updated_at aren't mass-assignable, so backdate them
            // separately once the row exists — this is what actually spreads
            // the seeded employees across years for the trend charts.
            $employee->forceFill([
                'created_at' => $createdAt,
                'updated_at' => $activatedAt ?? $invitedAt ?? $createdAt,
            ])->save();

            $street = $streets[$n % count($streets)];
            $nokFirstName = $firstNames[($n * 13 + 5) % count($firstNames)];

            $employee->profile()->firstOrCreate(
                ['employee_id' => $employee->id],
                [
                    'gender' => $gender,
                    'personal_email' => $emailBase.'.personal@example.com',
                    'residential_address' => $street,
                    'next_of_kin_name' => $nokFirstName.' '.$lastName,
                    'next_of_kin_phone' => '0805'.str_pad((string) ($n + 500), 7, '0', STR_PAD_LEFT),
                    'emergency_contact_name' => $nokFirstName.' '.$lastName,
                    'emergency_contact_phone' => '0805'.str_pad((string) ($n + 600), 7, '0', STR_PAD_LEFT),
                    'completion_status' => $profileStatus,
                ]
            );

            EmployeeStatusHistory::query()->firstOrCreate(
                [
                    'organization_id' => $organization->id,
                    'employee_id' => $employee->id,
                    'new_status' => $status,
                    'effective_date' => $startDate->toDateString(),
                ],
                [
                    'changed_by_id' => $admin?->id,
                    'previous_status' => null,
                    'reason' => 'Seeded for dashboard and report variety.',
                    'note' => 'Seeded via EmployeeVarietySeeder.',
                ]
            );
        }
    }
}
