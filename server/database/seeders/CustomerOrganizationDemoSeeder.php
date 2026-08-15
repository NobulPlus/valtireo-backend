<?php

namespace Database\Seeders;

use App\Models\Department;
use App\Models\Designation;
use App\Models\DocumentRequirement;
use App\Models\DocumentType;
use App\Models\Employee;
use App\Models\EmploymentType;
use App\Models\GradeLevel;
use App\Models\Organization;
use App\Models\OrganizationLocation;
use App\Models\PlatformModule;
use App\Models\Unit;
use App\Models\User;
use App\Services\DefaultApprovalWorkflowService;
use Carbon\Carbon;
use Illuminate\Database\Seeder;

class CustomerOrganizationDemoSeeder extends Seeder
{
    /**
     * Seed varied customer organizations for platform-console testing.
     */
    public function run(): void
    {
        foreach ($this->organizations() as $organizationData) {
            $organization = $this->seedOrganization($organizationData);
            $this->seedModules($organization, $organizationData['modules']);
            $this->seedLocations($organization, $organizationData['locations']);
            $this->seedStructure($organization, $organizationData['departments']);
            $this->seedAdmin($organization, $organizationData['admin']);
            $employees = $this->seedEmployees($organization, $organizationData['employees']);
            $this->seedDocuments($organization, $organizationData['document_types'], $employees);
            $this->seedLeave($organization, $organizationData['leave_types'], $employees);
            $this->seedAttendance($organization, $organizationData['attendance'], $employees);
        }
    }

    /**
     * @param array<string, mixed> $data
     */
    private function seedOrganization(array $data): Organization
    {
        $organization = Organization::query()->firstOrCreate(
            ['code' => $data['code']],
            [
                'name' => $data['name'],
                'email' => $data['email'],
                'phone' => $data['phone'],
                'website' => $data['website'],
                'sector' => $data['sector'],
                'status' => $data['status'],
                'address' => $data['address'],
                'city' => $data['city'],
                'state' => $data['state'],
                'country' => $data['country'],
                'settings' => $data['settings'],
            ]
        );

        $organization->update([
            'name' => $data['name'],
            'email' => $data['email'],
            'phone' => $data['phone'],
            'website' => $data['website'],
            'sector' => $data['sector'],
            'status' => $data['status'],
            'address' => $data['address'],
            'city' => $data['city'],
            'state' => $data['state'],
            'country' => $data['country'],
            'settings' => $data['settings'],
        ]);

        app(DefaultApprovalWorkflowService::class)->seedForOrganization($organization);

        return $organization->refresh();
    }

    /**
     * @param array<int, string> $moduleKeys
     */
    private function seedModules(Organization $organization, array $moduleKeys): void
    {
        $modules = PlatformModule::query()
            ->whereIn('key', $moduleKeys)
            ->where('is_active', true)
            ->get();

        foreach ($modules as $module) {
            $organization->moduleSubscriptions()->updateOrCreate(
                ['platform_module_id' => $module->id],
                [
                    'status' => 'active',
                    'starts_at' => now()->subDays(fake()->numberBetween(12, 120)),
                    'expires_at' => null,
                    'settings' => [],
                ]
            );
        }
    }

    /**
     * @param array<int, array<string, mixed>> $locations
     */
    private function seedLocations(Organization $organization, array $locations): void
    {
        foreach ($locations as $index => $location) {
            $organization->locations()->updateOrCreate(
                ['code' => $location['code']],
                [
                    'name' => $location['name'],
                    'type' => $location['type'],
                    'email' => strtolower($location['code']).'@'.strtolower($organization->code).'.test',
                    'phone' => $location['phone'] ?? $organization->phone,
                    'address' => $location['address'],
                    'city' => $location['city'],
                    'state' => $location['state'],
                    'country' => $location['country'] ?? $organization->country,
                    'is_primary' => $index === 0,
                    'is_active' => $location['is_active'] ?? true,
                ]
            );
        }
    }

    /**
     * @param array<int, array<string, mixed>> $departments
     */
    private function seedStructure(Organization $organization, array $departments): void
    {
        foreach ($this->employmentTypes() as $type) {
            $organization->employmentTypes()->updateOrCreate(
                ['code' => $type['code']],
                [...$type, 'is_active' => true]
            );
        }

        foreach ($this->gradeLevels() as $grade) {
            $organization->gradeLevels()->updateOrCreate(
                ['code' => $grade['code']],
                [...$grade, 'is_active' => true]
            );
        }

        foreach ($this->designations() as $designation) {
            $organization->designations()->updateOrCreate(
                ['code' => $designation['code']],
                [...$designation, 'is_active' => true]
            );
        }

        foreach ($departments as $departmentData) {
            $department = $organization->departments()->updateOrCreate(
                ['code' => $departmentData['code']],
                [
                    'name' => $departmentData['name'],
                    'description' => $departmentData['description'],
                    'is_active' => true,
                ]
            );

            foreach ($departmentData['units'] as $unitData) {
                $organization->units()->updateOrCreate(
                    ['code' => $unitData['code']],
                    [
                        'department_id' => $department->id,
                        'name' => $unitData['name'],
                        'description' => $unitData['name'].' operations.',
                        'is_active' => true,
                    ]
                );
            }
        }
    }

    /**
     * @param array<string, string> $adminData
     */
    private function seedAdmin(Organization $organization, array $adminData): User
    {
        $admin = User::query()->firstOrCreate(
            ['email' => $adminData['email']],
            [
                'organization_id' => $organization->id,
                'name' => $adminData['name'],
                'password' => 'Password1!',
            ]
        );

        $admin->update([
            'organization_id' => $organization->id,
            'name' => $adminData['name'],
        ]);
        $admin->assignRole('Organization Admin');

        return $admin;
    }

    /**
     * @param array<int, array<string, mixed>> $employees
     *
     * @return array<string, Employee>
     */
    private function seedEmployees(Organization $organization, array $employees): array
    {
        $seeded = [];

        foreach ($employees as $employeeData) {
            $department = $this->department($organization, $employeeData['department_code']);
            $unit = $this->unit($organization, $employeeData['unit_code']);
            $designation = $this->designation($organization, $employeeData['designation_code']);
            $gradeLevel = $this->gradeLevel($organization, $employeeData['grade_level_code']);
            $employmentType = $this->employmentType($organization, $employeeData['employment_type_code']);
            $location = $this->location($organization, $employeeData['location_code']);

            $user = null;
            if ($employeeData['create_user']) {
                $user = User::query()->firstOrCreate(
                    ['email' => $employeeData['work_email']],
                    [
                        'organization_id' => $organization->id,
                        'name' => $employeeData['first_name'].' '.$employeeData['last_name'],
                        'password' => 'Password1!',
                    ]
                );
                $user->update(['organization_id' => $organization->id]);
                $user->assignRole($employeeData['role']);
            }

            $employee = Employee::query()->updateOrCreate(
                [
                    'organization_id' => $organization->id,
                    'employee_number' => $employeeData['employee_number'],
                ],
                [
                    'user_id' => $user?->id,
                    'first_name' => $employeeData['first_name'],
                    'middle_name' => $employeeData['middle_name'] ?? null,
                    'last_name' => $employeeData['last_name'],
                    'work_email' => $employeeData['work_email'],
                    'phone' => $employeeData['phone'],
                    'department_id' => $department->id,
                    'unit_id' => $unit->id,
                    'designation_id' => $designation->id,
                    'grade_level_id' => $gradeLevel->id,
                    'employment_type_id' => $employmentType->id,
                    'organization_location_id' => $location->id,
                    'reporting_manager_id' => null,
                    'start_date' => $employeeData['start_date'],
                    'status' => $employeeData['status'],
                    'invited_at' => in_array($employeeData['status'], ['invited', 'onboarding'], true) ? now()->subDays(3) : null,
                    'activated_at' => $employeeData['status'] === 'active' ? now()->subDays(15) : null,
                ]
            );

            $employee->profile()->updateOrCreate(
                ['employee_id' => $employee->id],
                [
                    'date_of_birth' => $employeeData['date_of_birth'],
                    'gender' => $employeeData['gender'],
                    'personal_email' => $employeeData['personal_email'],
                    'residential_address' => $employeeData['residential_address'],
                    'next_of_kin_name' => $employeeData['next_of_kin_name'],
                    'next_of_kin_phone' => $employeeData['next_of_kin_phone'],
                    'emergency_contact_name' => $employeeData['emergency_contact_name'],
                    'emergency_contact_phone' => $employeeData['emergency_contact_phone'],
                    'completion_status' => $employeeData['profile_status'],
                ]
            );

            $seeded[$employeeData['employee_number']] = $employee->refresh();
        }

        foreach ($employees as $employeeData) {
            if (! isset($employeeData['manager_number'])) {
                continue;
            }

            $seeded[$employeeData['employee_number']]->update([
                'reporting_manager_id' => $seeded[$employeeData['manager_number']]?->id,
            ]);
        }

        return $seeded;
    }

    /**
     * @param array<int, array<string, mixed>> $documentTypes
     * @param array<string, Employee> $employees
     */
    private function seedDocuments(Organization $organization, array $documentTypes, array $employees): void
    {
        foreach ($documentTypes as $typeData) {
            $type = $organization->documentTypes()->updateOrCreate(
                ['code' => $typeData['code']],
                [
                    'name' => $typeData['name'],
                    'description' => $typeData['description'],
                    'requires_expiry_date' => $typeData['requires_expiry_date'],
                    'default_reminder_days' => $typeData['default_reminder_days'],
                    'employee_upload_allowed' => true,
                    'approval_required' => $typeData['approval_required'],
                    'is_active' => true,
                ]
            );

            $requirement = DocumentRequirement::query()->updateOrCreate(
                [
                    'organization_id' => $organization->id,
                    'document_type_id' => $type->id,
                    'name' => $typeData['requirement_name'],
                ],
                [
                    'description' => $typeData['description'],
                    'is_required' => true,
                    'employee_upload_allowed' => true,
                    'approval_required' => $typeData['approval_required'],
                    'reminder_days' => $typeData['default_reminder_days'],
                    'is_active' => true,
                ]
            );

            foreach (collect($employees)->values()->take($typeData['sample_documents']) as $index => $employee) {
                $organization->employeeDocuments()->updateOrCreate(
                    [
                        'employee_id' => $employee->id,
                        'document_requirement_id' => $requirement->id,
                    ],
                    [
                        'document_type_id' => $type->id,
                        'uploaded_by_id' => $employee->user_id,
                        'title' => $type->name,
                        'file_name' => strtolower($employee->employee_number.'-'.$type->code).'.pdf',
                        'file_path' => 'demo/customer-documents/'.strtolower($organization->code.'/'.$employee->employee_number.'/'.$type->code).'.pdf',
                        'mime_type' => 'application/pdf',
                        'file_size' => 90000 + ($index * 7500),
                        'issued_at' => now()->subMonths(10),
                        'expires_at' => $type->requires_expiry_date ? now()->addDays(20 + ($index * 35)) : null,
                        'status' => $index % 3 === 0 ? 'submitted' : 'approved',
                        'submitted_at' => now()->subDays(7),
                        'reviewed_at' => $index % 3 === 0 ? null : now()->subDays(5),
                    ]
                );
            }
        }
    }

    /**
     * @param array<int, array<string, mixed>> $leaveTypes
     * @param array<string, Employee> $employees
     */
    private function seedLeave(Organization $organization, array $leaveTypes, array $employees): void
    {
        $period = $organization->leavePeriods()->updateOrCreate(
            ['name' => '2026 Leave Year'],
            [
                'starts_on' => '2026-01-01',
                'ends_on' => '2026-12-31',
                'is_active' => true,
            ]
        );

        foreach ([0, 1, 2, 3, 4, 5, 6] as $day) {
            $organization->leaveWorkDays()->updateOrCreate(
                ['day_of_week' => $day],
                ['is_working_day' => in_array($day, [1, 2, 3, 4, 5], true)]
            );
        }

        foreach ($leaveTypes as $typeData) {
            $leaveType = $organization->leaveTypes()->updateOrCreate(
                ['code' => $typeData['code']],
                [
                    'name' => $typeData['name'],
                    'description' => $typeData['description'],
                    'is_paid' => $typeData['is_paid'],
                    'requires_attachment' => $typeData['requires_attachment'],
                    'minimum_notice_days' => $typeData['minimum_notice_days'],
                    'maximum_days_per_request' => $typeData['maximum_days_per_request'],
                    'is_active' => true,
                ]
            );

            foreach ($employees as $employee) {
                if ($employee->status !== 'active') {
                    continue;
                }

                $organization->leaveEntitlements()->updateOrCreate(
                    [
                        'employee_id' => $employee->id,
                        'leave_type_id' => $leaveType->id,
                        'leave_period_id' => $period->id,
                    ],
                    [
                        'days_allocated' => $typeData['days_allocated'],
                        'notes' => 'Seeded customer organization entitlement.',
                    ]
                );
            }
        }

        $firstActive = collect($employees)->first(fn (Employee $employee) => $employee->status === 'active');
        $firstType = $organization->leaveTypes()->first();

        if ($firstActive && $firstType) {
            $organization->leaveRequests()->updateOrCreate(
                [
                    'employee_id' => $firstActive->id,
                    'leave_type_id' => $firstType->id,
                    'starts_on' => '2026-09-14',
                ],
                [
                    'leave_period_id' => $period->id,
                    'requested_by_id' => $firstActive->user_id,
                    'ends_on' => '2026-09-16',
                    'total_days' => 3,
                    'status' => 'submitted',
                    'reason' => 'Seeded customer leave request.',
                    'submitted_at' => now()->subDays(2),
                ]
            );
        }
    }

    /**
     * @param array<string, mixed> $attendance
     * @param array<string, Employee> $employees
     */
    private function seedAttendance(Organization $organization, array $attendance, array $employees): void
    {
        $organization->attendanceSetting()->updateOrCreate(
            ['organization_id' => $organization->id],
            [
                'timezone' => $attendance['timezone'],
                'late_grace_minutes' => $attendance['late_grace_minutes'],
                'early_checkout_grace_minutes' => $attendance['early_checkout_grace_minutes'],
                'rounding_minutes' => $attendance['rounding_minutes'],
                'allow_employee_clock_in' => $attendance['allow_employee_clock_in'],
                'allow_employee_corrections' => true,
                'require_approval_for_corrections' => true,
                'allowed_sources' => $attendance['allowed_sources'],
            ]
        );

        $shift = $organization->workShifts()->updateOrCreate(
            ['code' => $attendance['shift']['code']],
            [
                'name' => $attendance['shift']['name'],
                'starts_at' => $attendance['shift']['starts_at'],
                'ends_at' => $attendance['shift']['ends_at'],
                'break_minutes' => $attendance['shift']['break_minutes'],
                'is_overnight' => $attendance['shift']['is_overnight'],
                'is_default' => true,
                'is_active' => true,
            ]
        );

        $recorder = $organization->users()->first();

        foreach (collect($employees)->filter(fn (Employee $employee) => $employee->status === 'active')->take(5)->values() as $index => $employee) {
            $date = Carbon::parse('2026-08-10')->subDays($index);
            $lateMinutes = $index === 2 ? $attendance['late_grace_minutes'] + 12 : 0;
            $checkIn = $date->copy()->setTimeFromTimeString($attendance['shift']['starts_at'])->addMinutes($lateMinutes);
            $checkOut = $date->copy()->setTimeFromTimeString($attendance['shift']['ends_at']);

            if ($attendance['shift']['is_overnight']) {
                $checkOut->addDay();
            }

            $organization->attendanceRecords()->updateOrCreate(
                [
                    'employee_id' => $employee->id,
                    'attendance_date' => $date->toDateString(),
                ],
                [
                    'work_shift_id' => $shift->id,
                    'recorded_by_id' => $recorder?->id,
                    'check_in_at' => $checkIn,
                    'check_out_at' => $index === 4 ? null : $checkOut,
                    'duration_minutes' => $index === 4 ? 0 : max($checkIn->diffInMinutes($checkOut) - $shift->break_minutes, 0),
                    'source' => $attendance['allowed_sources'][0],
                    'status' => $index === 4 ? 'absent' : ($lateMinutes > 0 ? 'late' : 'present'),
                    'notes' => 'Seeded customer attendance record.',
                ]
            );
        }
    }

    private function department(Organization $organization, string $code): Department
    {
        return $organization->departments()->where('code', $code)->firstOrFail();
    }

    private function unit(Organization $organization, string $code): Unit
    {
        return $organization->units()->where('code', $code)->firstOrFail();
    }

    private function designation(Organization $organization, string $code): Designation
    {
        return $organization->designations()->where('code', $code)->firstOrFail();
    }

    private function gradeLevel(Organization $organization, string $code): GradeLevel
    {
        return $organization->gradeLevels()->where('code', $code)->firstOrFail();
    }

    private function employmentType(Organization $organization, string $code): EmploymentType
    {
        return $organization->employmentTypes()->where('code', $code)->firstOrFail();
    }

    private function location(Organization $organization, string $code): OrganizationLocation
    {
        return $organization->locations()->where('code', $code)->firstOrFail();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function employmentTypes(): array
    {
        return [
            ['name' => 'Permanent', 'code' => 'PERM', 'description' => 'Permanent employment.'],
            ['name' => 'Contract', 'code' => 'CONT', 'description' => 'Fixed-term contract.'],
            ['name' => 'Part Time', 'code' => 'PART', 'description' => 'Part-time engagement.'],
            ['name' => 'Field Consultant', 'code' => 'FIELD', 'description' => 'Field consultant engagement.'],
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function gradeLevels(): array
    {
        return [
            ['name' => 'Associate', 'code' => 'G01', 'rank' => 1, 'description' => 'Associate level.'],
            ['name' => 'Officer', 'code' => 'G02', 'rank' => 2, 'description' => 'Officer level.'],
            ['name' => 'Senior Officer', 'code' => 'G03', 'rank' => 3, 'description' => 'Senior officer level.'],
            ['name' => 'Manager', 'code' => 'G04', 'rank' => 4, 'description' => 'Manager level.'],
            ['name' => 'Director', 'code' => 'G05', 'rank' => 5, 'description' => 'Director level.'],
        ];
    }

    /**
     * @return array<int, array<string, string>>
     */
    private function designations(): array
    {
        return [
            ['name' => 'Chief Executive Officer', 'code' => 'CEO', 'description' => 'Executive lead.'],
            ['name' => 'People Operations Manager', 'code' => 'POM', 'description' => 'People operations lead.'],
            ['name' => 'Department Manager', 'code' => 'DM', 'description' => 'Department manager.'],
            ['name' => 'Team Lead', 'code' => 'TL', 'description' => 'Team lead.'],
            ['name' => 'Analyst', 'code' => 'ANL', 'description' => 'Analyst role.'],
            ['name' => 'Field Officer', 'code' => 'FO', 'description' => 'Field operations role.'],
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function organizations(): array
    {
        return [
            [
                'name' => 'Sterling Grove Microfinance Bank',
                'code' => 'STERLINGGROVE',
                'email' => 'people@sterlinggrovemfb.test',
                'phone' => '+2347001002001',
                'website' => 'https://sterlinggrovemfb.test',
                'sector' => 'financial services',
                'status' => 'active',
                'address' => '18 Marina Road',
                'city' => 'Lagos Island',
                'state' => 'Lagos',
                'country' => 'Nigeria',
                'admin' => ['name' => 'Nora Ibrahim', 'email' => 'nora.ibrahim@sterlinggrovemfb.test'],
                'settings' => $this->settings('#0B5D5A', '#E0A106', 'Aptos', 'compact', 'Welcome to Sterling Grove people operations.'),
                'modules' => ['organization_setup', 'users_roles', 'organization_structure', 'employees', 'employee_self_service', 'documents', 'leave', 'attendance', 'reports', 'audit_logs', 'payroll'],
                'locations' => [
                    ['name' => 'Marina Headquarters', 'code' => 'HQ', 'type' => 'head_office', 'address' => '18 Marina Road', 'city' => 'Lagos Island', 'state' => 'Lagos'],
                    ['name' => 'Abeokuta Branch', 'code' => 'ABK', 'type' => 'branch', 'address' => '4 Quarry Road', 'city' => 'Abeokuta', 'state' => 'Ogun'],
                    ['name' => 'Kano Service Desk', 'code' => 'KAN', 'type' => 'branch', 'address' => '21 Zoo Road', 'city' => 'Kano', 'state' => 'Kano'],
                ],
                'departments' => $this->departmentPack(['Credit', 'Risk', 'Treasury', 'Customer Success']),
                'employees' => $this->employeePack('SGM', 'sterlinggrovemfb.test', ['Credit', 'Risk', 'Treasury', 'Customer Success'], ['HQ', 'ABK', 'KAN']),
                'document_types' => $this->documentPack(['BVN Consent', 'Fit and Proper Form', 'Loan Officer License']),
                'leave_types' => $this->leavePack(['Annual Leave', 'Exam Leave', 'Compassionate Leave']),
                'attendance' => $this->attendancePack('REG', 'Regular Banking Shift', '08:30', '17:00', ['manual', 'import']),
            ],
            [
                'name' => 'Cedarcare Specialist Hospital',
                'code' => 'CEDARCARE',
                'email' => 'hr@cedarcare.test',
                'phone' => '+2347001002002',
                'website' => 'https://cedarcare.test',
                'sector' => 'healthcare',
                'status' => 'setup_in_progress',
                'address' => '6 Queens Drive',
                'city' => 'Ibadan',
                'state' => 'Oyo',
                'country' => 'Nigeria',
                'admin' => ['name' => 'Dr. Ifeoma Umeh', 'email' => 'ifeoma.umeh@cedarcare.test'],
                'settings' => $this->settings('#146C43', '#C2410C', 'Inter', 'comfortable', 'Welcome to Cedarcare workforce desk.'),
                'modules' => ['organization_setup', 'users_roles', 'organization_structure', 'employees', 'employee_self_service', 'documents', 'attendance', 'reports', 'audit_logs'],
                'locations' => [
                    ['name' => 'Ibadan Main Hospital', 'code' => 'IBD', 'type' => 'head_office', 'address' => '6 Queens Drive', 'city' => 'Ibadan', 'state' => 'Oyo'],
                    ['name' => 'Akure Clinic', 'code' => 'AKR', 'type' => 'clinic', 'address' => '9 Alagbaka Road', 'city' => 'Akure', 'state' => 'Ondo'],
                ],
                'departments' => $this->departmentPack(['Clinical Services', 'Nursing', 'Pharmacy', 'Patient Administration']),
                'employees' => $this->employeePack('CDH', 'cedarcare.test', ['Clinical Services', 'Nursing', 'Pharmacy', 'Patient Administration'], ['IBD', 'AKR']),
                'document_types' => $this->documentPack(['Medical License', 'Immunization Record', 'Training Certificate']),
                'leave_types' => $this->leavePack(['Annual Leave', 'Sick Leave', 'Study Leave']),
                'attendance' => $this->attendancePack('CLINIC', 'Clinical Day Shift', '07:00', '15:00', ['employee', 'manual', 'import']),
            ],
            [
                'name' => 'Greenfield Foods Distribution',
                'code' => 'GREENFIELD',
                'email' => 'admin@greenfieldfoods.test',
                'phone' => '+2347001002003',
                'website' => 'https://greenfieldfoods.test',
                'sector' => 'logistics and distribution',
                'status' => 'active',
                'address' => '42 Industrial Layout',
                'city' => 'Onitsha',
                'state' => 'Anambra',
                'country' => 'Nigeria',
                'admin' => ['name' => 'Emeka Obi', 'email' => 'emeka.obi@greenfieldfoods.test'],
                'settings' => $this->settings('#176B3A', '#B45309', 'Roboto', 'compact', 'Welcome to Greenfield operations.'),
                'modules' => ['organization_setup', 'users_roles', 'organization_structure', 'employees', 'employee_self_service', 'documents', 'leave', 'attendance', 'deployment', 'reports'],
                'locations' => [
                    ['name' => 'Onitsha Warehouse', 'code' => 'ONT', 'type' => 'head_office', 'address' => '42 Industrial Layout', 'city' => 'Onitsha', 'state' => 'Anambra'],
                    ['name' => 'Port Harcourt Hub', 'code' => 'PHC', 'type' => 'warehouse', 'address' => '11 Trans-Amadi Road', 'city' => 'Port Harcourt', 'state' => 'Rivers'],
                    ['name' => 'Enugu Depot', 'code' => 'ENU', 'type' => 'depot', 'address' => '5 Independence Layout', 'city' => 'Enugu', 'state' => 'Enugu'],
                ],
                'departments' => $this->departmentPack(['Warehouse', 'Fleet Coordination', 'Procurement', 'Quality Control']),
                'employees' => $this->employeePack('GFD', 'greenfieldfoods.test', ['Warehouse', 'Fleet Coordination', 'Procurement', 'Quality Control'], ['ONT', 'PHC', 'ENU']),
                'document_types' => $this->documentPack(['Driver License', 'Health Certificate', 'Safety Induction']),
                'leave_types' => $this->leavePack(['Annual Leave', 'Sick Leave', 'Unpaid Leave']),
                'attendance' => $this->attendancePack('FIELD', 'Warehouse Shift', '06:30', '15:30', ['import', 'manual']),
            ],
            [
                'name' => 'Aurora Girls College',
                'code' => 'AURORA',
                'email' => 'hr@auroracollege.test',
                'phone' => '+2347001002004',
                'website' => 'https://auroracollege.test',
                'sector' => 'education',
                'status' => 'invited',
                'address' => '3 Mission Hill',
                'city' => 'Jos',
                'state' => 'Plateau',
                'country' => 'Nigeria',
                'admin' => ['name' => 'Grace Pam', 'email' => 'grace.pam@auroracollege.test'],
                'settings' => $this->settings('#334155', '#2A9D8F', 'Lato', 'comfortable', 'Welcome to Aurora staff portal.'),
                'modules' => ['organization_setup', 'organization_structure', 'employees', 'employee_self_service', 'documents', 'leave'],
                'locations' => [
                    ['name' => 'Jos Campus', 'code' => 'JOS', 'type' => 'campus', 'address' => '3 Mission Hill', 'city' => 'Jos', 'state' => 'Plateau'],
                ],
                'departments' => $this->departmentPack(['Academics', 'Student Affairs', 'Finance', 'Facilities']),
                'employees' => $this->employeePack('AGC', 'auroracollege.test', ['Academics', 'Student Affairs', 'Finance', 'Facilities'], ['JOS']),
                'document_types' => $this->documentPack(['Teaching Credential', 'Safeguarding Form', 'Reference Letter']),
                'leave_types' => $this->leavePack(['Term Break Leave', 'Sick Leave', 'Maternity Leave']),
                'attendance' => $this->attendancePack('SCHOOL', 'School Day', '07:30', '16:00', ['manual']),
            ],
            [
                'name' => 'Nimbus Renewable Energy',
                'code' => 'NIMBUS',
                'email' => 'people@nimbusenergy.test',
                'phone' => '+2347001002005',
                'website' => 'https://nimbusenergy.test',
                'sector' => 'energy',
                'status' => 'active',
                'address' => '15 Admiralty Road',
                'city' => 'Lekki',
                'state' => 'Lagos',
                'country' => 'Nigeria',
                'admin' => ['name' => 'Tomi Afolayan', 'email' => 'tomi.afolayan@nimbusenergy.test'],
                'settings' => $this->settings('#0F766E', '#D97706', 'Source Sans 3', 'comfortable', 'Welcome to Nimbus Energy workspace.'),
                'modules' => ['organization_setup', 'users_roles', 'organization_structure', 'employees', 'employee_self_service', 'documents', 'leave', 'attendance', 'deployment', 'reports', 'audit_logs', 'assets'],
                'locations' => [
                    ['name' => 'Lekki Headquarters', 'code' => 'LKI', 'type' => 'head_office', 'address' => '15 Admiralty Road', 'city' => 'Lekki', 'state' => 'Lagos'],
                    ['name' => 'Kaduna Solar Farm', 'code' => 'KDS', 'type' => 'field_office', 'address' => 'KM 8 Zaria Road', 'city' => 'Kaduna', 'state' => 'Kaduna'],
                    ['name' => 'Calabar Service Office', 'code' => 'CAL', 'type' => 'branch', 'address' => '22 Marian Road', 'city' => 'Calabar', 'state' => 'Cross River'],
                ],
                'departments' => $this->departmentPack(['Engineering', 'Field Operations', 'Customer Projects', 'Health and Safety']),
                'employees' => $this->employeePack('NRE', 'nimbusenergy.test', ['Engineering', 'Field Operations', 'Customer Projects', 'Health and Safety'], ['LKI', 'KDS', 'CAL']),
                'document_types' => $this->documentPack(['Site Safety Permit', 'Engineering License', 'Medical Fitness']),
                'leave_types' => $this->leavePack(['Annual Leave', 'Field Rest Days', 'Sick Leave']),
                'attendance' => $this->attendancePack('SOLAR', 'Field Rotation Shift', '08:00', '18:00', ['employee', 'import']),
            ],
            [
                'name' => 'Bluebridge Legal Partners',
                'code' => 'BLUEBRIDGE',
                'email' => 'admin@bluebridgelegal.test',
                'phone' => '+2347001002006',
                'website' => 'https://bluebridgelegal.test',
                'sector' => 'professional services',
                'status' => 'suspended',
                'address' => '12 Walter Carrington Crescent',
                'city' => 'Victoria Island',
                'state' => 'Lagos',
                'country' => 'Nigeria',
                'admin' => ['name' => 'Bola Sanni', 'email' => 'bola.sanni@bluebridgelegal.test'],
                'settings' => $this->settings('#1E3A5F', '#A16207', 'Georgia', 'comfortable', 'Welcome to Bluebridge legal operations.'),
                'modules' => ['organization_setup', 'users_roles', 'organization_structure', 'employees', 'employee_self_service', 'documents', 'leave', 'reports', 'audit_logs'],
                'locations' => [
                    ['name' => 'Victoria Island Office', 'code' => 'VI', 'type' => 'head_office', 'address' => '12 Walter Carrington Crescent', 'city' => 'Victoria Island', 'state' => 'Lagos'],
                    ['name' => 'Abuja Chambers', 'code' => 'ABJ', 'type' => 'branch', 'address' => '8 Ademola Adetokunbo Crescent', 'city' => 'Wuse II', 'state' => 'FCT'],
                ],
                'departments' => $this->departmentPack(['Litigation', 'Corporate Advisory', 'Compliance', 'Administration']),
                'employees' => $this->employeePack('BLP', 'bluebridgelegal.test', ['Litigation', 'Corporate Advisory', 'Compliance', 'Administration'], ['VI', 'ABJ']),
                'document_types' => $this->documentPack(['Call to Bar Certificate', 'Practicing Fee Receipt', 'Conflict Declaration']),
                'leave_types' => $this->leavePack(['Annual Leave', 'Court Recess Leave', 'Sick Leave']),
                'attendance' => $this->attendancePack('LEGAL', 'Office Shift', '09:00', '18:00', ['manual']),
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function settings(string $primary, string $accent, string $font, string $density, string $message): array
    {
        return [
            'identity' => [
                'welcome_message' => $message,
                'support_email' => null,
            ],
            'theme' => [
                'mode' => 'light',
                'primary_color' => $primary,
                'accent_color' => $accent,
                'sidebar_color' => $primary,
                'button_color' => $primary,
                'font_family' => $font,
                'radius' => 'soft',
                'density' => $density,
            ],
            'localization' => [
                'timezone' => 'Africa/Lagos',
                'date_format' => 'd/m/Y',
                'time_format' => '24h',
                'currency' => 'NGN',
                'country' => 'Nigeria',
            ],
        ];
    }

    /**
     * @param array<int, string> $names
     *
     * @return array<int, array<string, mixed>>
     */
    private function departmentPack(array $names): array
    {
        return collect($names)->map(fn (string $name) => [
            'name' => $name,
            'code' => strtoupper(substr(preg_replace('/[^A-Za-z]/', '', $name), 0, 3)),
            'description' => $name.' department.',
            'units' => [
                ['name' => $name.' Operations', 'code' => strtoupper(substr(preg_replace('/[^A-Za-z]/', '', $name), 0, 3)).'-OPS'],
                ['name' => $name.' Records', 'code' => strtoupper(substr(preg_replace('/[^A-Za-z]/', '', $name), 0, 3)).'-REC'],
            ],
        ])->all();
    }

    /**
     * @param array<int, string> $departmentNames
     * @param array<int, string> $locationCodes
     *
     * @return array<int, array<string, mixed>>
     */
    private function employeePack(string $prefix, string $domain, array $departmentNames, array $locationCodes): array
    {
        $people = [
            ['Adaora', 'Mensah', 'female'],
            ['Tunde', 'Lawal', 'male'],
            ['Rita', 'Danjuma', 'female'],
            ['Kelvin', 'Etim', 'male'],
            ['Hauwa', 'Sule', 'female'],
            ['Victor', 'Iheanacho', 'male'],
            ['Olamide', 'George', 'female'],
            ['Nnamdi', 'Okoye', 'male'],
        ];

        return collect($people)->map(function (array $person, int $index) use ($prefix, $domain, $departmentNames, $locationCodes) {
            $departmentName = $departmentNames[$index % count($departmentNames)];
            $departmentCode = strtoupper(substr(preg_replace('/[^A-Za-z]/', '', $departmentName), 0, 3));
            $number = $index + 1;
            $status = ['active', 'active', 'active', 'onboarding', 'draft', 'active', 'invited', 'active'][$index];

            return [
                'employee_number' => sprintf('%s-%03d', $prefix, $number),
                'first_name' => $person[0],
                'last_name' => $person[1],
                'work_email' => strtolower($person[0].'.'.$person[1].'@'.$domain),
                'phone' => '080'.str_pad((string) (40000000 + $index + strlen($prefix)), 8, '0', STR_PAD_LEFT),
                'department_code' => $departmentCode,
                'unit_code' => $departmentCode.($index % 2 === 0 ? '-OPS' : '-REC'),
                'designation_code' => $index === 0 ? 'POM' : ($index % 3 === 0 ? 'TL' : 'ANL'),
                'grade_level_code' => 'G0'.min(5, max(1, 5 - ($index % 5))),
                'employment_type_code' => ['PERM', 'CONT', 'FIELD', 'PART'][$index % 4],
                'location_code' => $locationCodes[$index % count($locationCodes)],
                'role' => $index === 0 ? 'HR Director' : ($index === 3 ? 'Department Head' : 'Employee'),
                'create_user' => ! in_array($status, ['draft'], true),
                'status' => $status,
                'start_date' => Carbon::parse('2024-01-15')->addDays($index * 38)->toDateString(),
                'date_of_birth' => Carbon::parse('1988-02-01')->addDays($index * 411)->toDateString(),
                'gender' => $person[2],
                'personal_email' => strtolower($person[0].'.home@example.com'),
                'residential_address' => ($index + 3).' Demo Avenue, '.$locationCodes[$index % count($locationCodes)],
                'next_of_kin_name' => $person[1].' Family Contact',
                'next_of_kin_phone' => '081'.str_pad((string) (30000000 + $index), 8, '0', STR_PAD_LEFT),
                'emergency_contact_name' => $person[1].' Emergency Contact',
                'emergency_contact_phone' => '070'.str_pad((string) (20000000 + $index), 8, '0', STR_PAD_LEFT),
                'profile_status' => ['approved', 'submitted', 'approved', 'pending', 'pending', 'approved', 'submitted', 'approved'][$index],
                'manager_number' => $index > 0 ? sprintf('%s-%03d', $prefix, 1) : null,
            ];
        })->all();
    }

    /**
     * @param array<int, string> $names
     *
     * @return array<int, array<string, mixed>>
     */
    private function documentPack(array $names): array
    {
        return collect($names)->map(fn (string $name, int $index) => [
            'name' => $name,
            'code' => strtoupper(substr(preg_replace('/[^A-Za-z]/', '', $name), 0, 12)),
            'description' => $name.' required for compliance.',
            'requires_expiry_date' => $index !== 1,
            'default_reminder_days' => [30, 45, 60][$index],
            'approval_required' => $index !== 2,
            'requirement_name' => $name.' requirement',
            'sample_documents' => 3 + $index,
        ])->all();
    }

    /**
     * @param array<int, string> $names
     *
     * @return array<int, array<string, mixed>>
     */
    private function leavePack(array $names): array
    {
        return collect($names)->map(fn (string $name, int $index) => [
            'name' => $name,
            'code' => strtoupper(substr(preg_replace('/[^A-Za-z]/', '', $name), 0, 14)),
            'description' => $name.' policy.',
            'is_paid' => $index !== 2,
            'requires_attachment' => str_contains(strtolower($name), 'sick'),
            'minimum_notice_days' => $index === 0 ? 5 : 0,
            'maximum_days_per_request' => [15, 10, 7][$index],
            'days_allocated' => [21, 10, 5][$index],
        ])->all();
    }

    /**
     * @param array<int, string> $sources
     *
     * @return array<string, mixed>
     */
    private function attendancePack(string $code, string $name, string $startsAt, string $endsAt, array $sources): array
    {
        return [
            'timezone' => 'Africa/Lagos',
            'late_grace_minutes' => in_array($code, ['CLINIC', 'FIELD'], true) ? 10 : 15,
            'early_checkout_grace_minutes' => 10,
            'rounding_minutes' => 0,
            'allow_employee_clock_in' => in_array('employee', $sources, true),
            'allowed_sources' => $sources,
            'shift' => [
                'code' => $code,
                'name' => $name,
                'starts_at' => $startsAt,
                'ends_at' => $endsAt,
                'break_minutes' => 60,
                'is_overnight' => false,
            ],
        ];
    }
}
