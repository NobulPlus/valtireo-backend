<?php

namespace Database\Seeders;

use App\Models\Department;
use App\Models\Designation;
use App\Models\DocumentRequirement;
use App\Models\DocumentType;
use App\Models\Employee;
use App\Models\EmployeeDocument;
use App\Models\EmploymentType;
use App\Models\GradeLevel;
use App\Models\Organization;
use App\Models\OrganizationLocation;
use App\Models\Unit;
use App\Models\User;
use Illuminate\Database\Seeder;

class RichDemoDataSeeder extends Seeder
{
    /**
     * Seed richer demo data for local Postman and frontend testing.
     */
    public function run(): void
    {
        $organization = Organization::query()->where('code', 'VALTIREO')->firstOrFail();

        $this->seedLocations($organization);
        $this->seedUnits($organization);
        $this->seedEmployees($organization);
        $this->seedDocumentCompliance($organization);
    }

    private function seedLocations(Organization $organization): void
    {
        foreach ([
            ['name' => 'Ikeja Office', 'code' => 'IKEJA', 'type' => 'branch', 'city' => 'Ikeja', 'state' => 'Lagos'],
            ['name' => 'Lekki Field Office', 'code' => 'LEKKI', 'type' => 'field_office', 'city' => 'Lekki', 'state' => 'Lagos'],
            ['name' => 'Abuja Liaison Office', 'code' => 'ABJ', 'type' => 'branch', 'city' => 'Abuja', 'state' => 'FCT'],
        ] as $location) {
            $organization->locations()->firstOrCreate(
                ['code' => $location['code']],
                [
                    ...$location,
                    'email' => strtolower($location['code']).'@valtireo.test',
                    'phone' => '+2340000000000',
                    'address' => $location['name'],
                    'country' => 'Nigeria',
                    'is_primary' => false,
                    'is_active' => true,
                ]
            );
        }
    }

    private function seedUnits(Organization $organization): void
    {
        $departmentUnits = [
            'FIN' => [
                ['name' => 'Payroll Preparation', 'code' => 'FIN-PAY'],
                ['name' => 'Budget and Cost Control', 'code' => 'FIN-BUD'],
            ],
            'ICT' => [
                ['name' => 'Systems Administration', 'code' => 'ICT-SYS'],
                ['name' => 'User Support', 'code' => 'ICT-SUP'],
            ],
            'CMP' => [
                ['name' => 'Audit Readiness', 'code' => 'CMP-AUD'],
                ['name' => 'Policy Compliance', 'code' => 'CMP-POL'],
            ],
            'OPS' => [
                ['name' => 'Provider Verification', 'code' => 'OPS-PV'],
                ['name' => 'Deployment Coordination', 'code' => 'OPS-DEP'],
            ],
        ];

        foreach ($departmentUnits as $departmentCode => $units) {
            $department = $organization->departments()->where('code', $departmentCode)->firstOrFail();

            foreach ($units as $unit) {
                $organization->units()->firstOrCreate(
                    ['code' => $unit['code']],
                    [
                        ...$unit,
                        'department_id' => $department->id,
                        'description' => $unit['name'].' unit.',
                        'is_active' => true,
                    ]
                );
            }
        }
    }

    private function seedEmployees(Organization $organization): void
    {
        foreach ($this->employees() as $employeeData) {
            $department = Department::query()
                ->whereBelongsTo($organization)
                ->where('code', $employeeData['department_code'])
                ->firstOrFail();
            $unit = Unit::query()
                ->whereBelongsTo($organization)
                ->where('code', $employeeData['unit_code'])
                ->firstOrFail();
            $designation = Designation::query()
                ->whereBelongsTo($organization)
                ->where('code', $employeeData['designation_code'])
                ->firstOrFail();
            $gradeLevel = GradeLevel::query()
                ->whereBelongsTo($organization)
                ->where('code', $employeeData['grade_level_code'])
                ->firstOrFail();
            $employmentType = EmploymentType::query()
                ->whereBelongsTo($organization)
                ->where('code', $employeeData['employment_type_code'])
                ->firstOrFail();
            $location = OrganizationLocation::query()
                ->whereBelongsTo($organization)
                ->where('code', $employeeData['location_code'])
                ->firstOrFail();

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

            $employee = Employee::query()->firstOrCreate(
                [
                    'organization_id' => $organization->id,
                    'employee_number' => $employeeData['employee_number'],
                ],
                [
                    'user_id' => $user?->id,
                    'first_name' => $employeeData['first_name'],
                    'middle_name' => null,
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
                    'activated_at' => $employeeData['status'] === 'active' ? now() : null,
                ]
            );

            $employee->profile()->firstOrCreate(
                ['employee_id' => $employee->id],
                [
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
        }
    }

    private function seedDocumentCompliance(Organization $organization): void
    {
        $types = [
            [
                'name' => 'Government ID',
                'code' => 'GOV-ID',
                'description' => 'Government-issued identity document.',
                'requires_expiry_date' => true,
                'default_reminder_days' => 45,
            ],
            [
                'name' => 'Employment Contract',
                'code' => 'EMP-CONTRACT',
                'description' => 'Signed employment contract or offer acceptance.',
                'requires_expiry_date' => false,
                'default_reminder_days' => 30,
            ],
            [
                'name' => 'Guarantor Form',
                'code' => 'GUARANTOR',
                'description' => 'Completed guarantor form.',
                'requires_expiry_date' => false,
                'default_reminder_days' => 30,
            ],
            [
                'name' => 'Professional License',
                'code' => 'PRO-LICENSE',
                'description' => 'Professional registration or practice license.',
                'requires_expiry_date' => true,
                'default_reminder_days' => 60,
            ],
        ];

        foreach ($types as $type) {
            $organization->documentTypes()->firstOrCreate(
                ['code' => $type['code']],
                [
                    ...$type,
                    'employee_upload_allowed' => true,
                    'approval_required' => true,
                    'is_active' => true,
                ]
            );
        }

        $permanent = $organization->employmentTypes()->where('code', 'PERM')->firstOrFail();
        $contract = $organization->employmentTypes()->where('code', 'CONT')->firstOrFail();

        foreach ([
            [
                'document_type_code' => 'GOV-ID',
                'name' => 'Government ID for all employees',
                'description' => 'Every employee must provide a valid government-issued ID.',
                'reminder_days' => 45,
            ],
            [
                'document_type_code' => 'EMP-CONTRACT',
                'name' => 'Signed contract for permanent employees',
                'description' => 'Permanent employees must have a signed employment contract.',
                'employment_type_id' => $permanent->id,
            ],
            [
                'document_type_code' => 'GUARANTOR',
                'name' => 'Guarantor form for contract employees',
                'description' => 'Contract employees must provide a guarantor form.',
                'employment_type_id' => $contract->id,
            ],
        ] as $requirement) {
            $type = DocumentType::query()
                ->whereBelongsTo($organization)
                ->where('code', $requirement['document_type_code'])
                ->firstOrFail();

            DocumentRequirement::query()->firstOrCreate(
                [
                    'organization_id' => $organization->id,
                    'document_type_id' => $type->id,
                    'name' => $requirement['name'],
                ],
                [
                    'description' => $requirement['description'],
                    'is_required' => true,
                    'employee_upload_allowed' => true,
                    'approval_required' => true,
                    'reminder_days' => $requirement['reminder_days'] ?? $type->default_reminder_days,
                    'employment_type_id' => $requirement['employment_type_id'] ?? null,
                    'is_active' => true,
                ]
            );
        }

        $employee = Employee::query()
            ->whereBelongsTo($organization)
            ->where('employee_number', 'EMP-HR-001')
            ->firstOrFail();
        $governmentId = DocumentType::query()
            ->whereBelongsTo($organization)
            ->where('code', 'GOV-ID')
            ->firstOrFail();
        $governmentIdRequirement = DocumentRequirement::query()
            ->whereBelongsTo($organization)
            ->where('document_type_id', $governmentId->id)
            ->firstOrFail();

        EmployeeDocument::query()->firstOrCreate(
            [
                'organization_id' => $organization->id,
                'employee_id' => $employee->id,
                'document_requirement_id' => $governmentIdRequirement->id,
            ],
            [
                'document_type_id' => $governmentId->id,
                'uploaded_by_id' => $employee->user_id,
                'reviewed_by_id' => null,
                'title' => 'Government ID',
                'file_name' => 'mariam-government-id.pdf',
                'file_path' => 'demo/documents/mariam-government-id.pdf',
                'mime_type' => 'application/pdf',
                'file_size' => 125000,
                'issued_at' => now()->subYear(),
                'expires_at' => now()->addYear(),
                'status' => 'approved',
                'submitted_at' => now()->subDays(5),
                'reviewed_at' => now()->subDays(4),
            ]
        );
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function employees(): array
    {
        return [
            [
                'employee_number' => 'EMP-HR-001',
                'first_name' => 'Mariam',
                'last_name' => 'Okafor',
                'work_email' => 'mariam.okafor@valtireo.test',
                'phone' => '08030000001',
                'department_code' => 'HR',
                'unit_code' => 'HR-REC',
                'designation_code' => 'HRD',
                'grade_level_code' => 'GL07',
                'employment_type_code' => 'PERM',
                'location_code' => 'HQ',
                'role' => 'HR Director',
                'create_user' => true,
                'status' => 'active',
                'start_date' => '2024-01-15',
                'gender' => 'female',
                'personal_email' => 'mariam.personal@example.com',
                'residential_address' => '10 Admiralty Way, Lekki',
                'next_of_kin_name' => 'Chinedu Okafor',
                'next_of_kin_phone' => '08030000101',
                'emergency_contact_name' => 'Tola Adebayo',
                'emergency_contact_phone' => '08030000201',
                'profile_status' => 'approved',
            ],
            [
                'employee_number' => 'EMP-HR-002',
                'first_name' => 'Kelechi',
                'last_name' => 'Nwosu',
                'work_email' => 'kelechi.nwosu@valtireo.test',
                'phone' => '08030000002',
                'department_code' => 'HR',
                'unit_code' => 'HR-ROB',
                'designation_code' => 'HRO',
                'grade_level_code' => 'GL04',
                'employment_type_code' => 'PERM',
                'location_code' => 'IKEJA',
                'role' => 'HR Officer',
                'create_user' => true,
                'status' => 'active',
                'start_date' => '2024-03-04',
                'gender' => 'male',
                'personal_email' => 'kelechi.personal@example.com',
                'residential_address' => '24 Allen Avenue, Ikeja',
                'next_of_kin_name' => 'Ngozi Nwosu',
                'next_of_kin_phone' => '08030000102',
                'emergency_contact_name' => 'Mariam Okafor',
                'emergency_contact_phone' => '08030000202',
                'profile_status' => 'approved',
            ],
            [
                'employee_number' => 'EMP-FIN-001',
                'first_name' => 'Aisha',
                'last_name' => 'Bello',
                'work_email' => 'aisha.bello@valtireo.test',
                'phone' => '08030000003',
                'department_code' => 'FIN',
                'unit_code' => 'FIN-PAY',
                'designation_code' => 'OFF',
                'grade_level_code' => 'GL05',
                'employment_type_code' => 'PERM',
                'location_code' => 'HQ',
                'role' => 'Employee',
                'create_user' => true,
                'status' => 'active',
                'start_date' => '2023-11-20',
                'gender' => 'female',
                'personal_email' => 'aisha.personal@example.com',
                'residential_address' => '8 Garki Crescent, Abuja',
                'next_of_kin_name' => 'Usman Bello',
                'next_of_kin_phone' => '08030000103',
                'emergency_contact_name' => 'Kelechi Nwosu',
                'emergency_contact_phone' => '08030000203',
                'profile_status' => 'approved',
            ],
            [
                'employee_number' => 'EMP-OPS-001',
                'first_name' => 'Daniel',
                'last_name' => 'Adeyemi',
                'work_email' => 'daniel.adeyemi@valtireo.test',
                'phone' => '08030000004',
                'department_code' => 'OPS',
                'unit_code' => 'OPS-PV',
                'designation_code' => 'SUP',
                'grade_level_code' => 'GL06',
                'employment_type_code' => 'PERM',
                'location_code' => 'LEKKI',
                'role' => 'Supervisor',
                'create_user' => true,
                'status' => 'active',
                'start_date' => '2024-05-10',
                'gender' => 'male',
                'personal_email' => 'daniel.personal@example.com',
                'residential_address' => '15 Chevron Drive, Lekki',
                'next_of_kin_name' => 'Bisi Adeyemi',
                'next_of_kin_phone' => '08030000104',
                'emergency_contact_name' => 'Mariam Okafor',
                'emergency_contact_phone' => '08030000204',
                'profile_status' => 'approved',
            ],
            [
                'employee_number' => 'EMP-ICT-001',
                'first_name' => 'Samuel',
                'last_name' => 'Eze',
                'work_email' => 'samuel.eze@valtireo.test',
                'phone' => '08030000005',
                'department_code' => 'ICT',
                'unit_code' => 'ICT-SYS',
                'designation_code' => 'OFF',
                'grade_level_code' => 'GL04',
                'employment_type_code' => 'CONT',
                'location_code' => 'HQ',
                'role' => 'ICT Admin',
                'create_user' => true,
                'status' => 'active',
                'start_date' => '2025-01-06',
                'gender' => 'male',
                'personal_email' => 'samuel.personal@example.com',
                'residential_address' => '5 Herbert Macaulay Way, Yaba',
                'next_of_kin_name' => 'Ifeoma Eze',
                'next_of_kin_phone' => '08030000105',
                'emergency_contact_name' => 'Kelechi Nwosu',
                'emergency_contact_phone' => '08030000205',
                'profile_status' => 'approved',
            ],
            [
                'employee_number' => 'EMP-CMP-001',
                'first_name' => 'Fatima',
                'last_name' => 'Yusuf',
                'work_email' => 'fatima.yusuf@valtireo.test',
                'phone' => '08030000006',
                'department_code' => 'CMP',
                'unit_code' => 'CMP-AUD',
                'designation_code' => 'OFF',
                'grade_level_code' => 'GL05',
                'employment_type_code' => 'PERM',
                'location_code' => 'ABJ',
                'role' => 'Compliance Officer',
                'create_user' => true,
                'status' => 'active',
                'start_date' => '2024-09-01',
                'gender' => 'female',
                'personal_email' => 'fatima.personal@example.com',
                'residential_address' => '20 Maitama Avenue, Abuja',
                'next_of_kin_name' => 'Aminu Yusuf',
                'next_of_kin_phone' => '08030000106',
                'emergency_contact_name' => 'Mariam Okafor',
                'emergency_contact_phone' => '08030000206',
                'profile_status' => 'approved',
            ],
            [
                'employee_number' => 'EMP-OPS-002',
                'first_name' => 'Joy',
                'last_name' => 'Udo',
                'work_email' => 'joy.udo@valtireo.test',
                'phone' => '08030000007',
                'department_code' => 'OPS',
                'unit_code' => 'OPS-DEP',
                'designation_code' => 'OFF',
                'grade_level_code' => 'GL03',
                'employment_type_code' => 'TEMP',
                'location_code' => 'LEKKI',
                'role' => 'Employee',
                'create_user' => false,
                'status' => 'draft',
                'start_date' => '2026-08-01',
                'gender' => 'female',
                'personal_email' => 'joy.personal@example.com',
                'residential_address' => '7 Admiralty Road, Lekki',
                'next_of_kin_name' => 'Ekaete Udo',
                'next_of_kin_phone' => '08030000107',
                'emergency_contact_name' => 'Daniel Adeyemi',
                'emergency_contact_phone' => '08030000207',
                'profile_status' => 'pending',
            ],
        ];
    }
}
