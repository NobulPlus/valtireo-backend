<?php

namespace Database\Seeders;

use App\Models\Organization;
use Illuminate\Database\Seeder;

class OrganizationStructureSeeder extends Seeder
{
    /**
     * Seed organization structure records for the demo organization.
     */
    public function run(): void
    {
        $organization = Organization::query()->where('code', 'VALTIREO')->firstOrFail();

        $departments = [
            ['name' => 'Human Resources', 'code' => 'HR', 'description' => 'Manages people operations, records, and HR workflows.'],
            ['name' => 'Finance and Accounts', 'code' => 'FIN', 'description' => 'Manages payroll preparation, finance records, and approvals.'],
            ['name' => 'Operations', 'code' => 'OPS', 'description' => 'Coordinates operational execution and field-facing work.'],
            ['name' => 'ICT', 'code' => 'ICT', 'description' => 'Manages technology support, systems, and access.'],
            ['name' => 'Compliance', 'code' => 'CMP', 'description' => 'Manages compliance, audit readiness, and policy controls.'],
        ];

        foreach ($departments as $department) {
            $organization->departments()->firstOrCreate(
                ['code' => $department['code']],
                $department + ['is_active' => true]
            );
        }

        $hr = $organization->departments()->where('code', 'HR')->firstOrFail();
        $operations = $organization->departments()->where('code', 'OPS')->firstOrFail();

        foreach ($this->units($hr->id, $operations->id) as $unit) {
            $organization->units()->firstOrCreate(
                ['code' => $unit['code']],
                $unit + ['is_active' => true]
            );
        }

        foreach ($this->designations() as $designation) {
            $organization->designations()->firstOrCreate(
                ['code' => $designation['code']],
                $designation + ['is_active' => true]
            );
        }

        foreach ($this->gradeLevels() as $gradeLevel) {
            $organization->gradeLevels()->firstOrCreate(
                ['code' => $gradeLevel['code']],
                $gradeLevel + ['is_active' => true]
            );
        }

        foreach ($this->employmentTypes() as $employmentType) {
            $organization->employmentTypes()->firstOrCreate(
                ['code' => $employmentType['code']],
                $employmentType + ['is_active' => true]
            );
        }
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function units(int $hrDepartmentId, int $operationsDepartmentId): array
    {
        return [
            [
                'department_id' => $hrDepartmentId,
                'name' => 'Employee Records',
                'code' => 'HR-REC',
                'description' => 'Maintains employee records and staff files.',
            ],
            [
                'department_id' => $hrDepartmentId,
                'name' => 'Recruitment and Onboarding',
                'code' => 'HR-ROB',
                'description' => 'Coordinates hiring, onboarding, and staff entry processes.',
            ],
            [
                'department_id' => $operationsDepartmentId,
                'name' => 'Field Operations',
                'code' => 'OPS-FLD',
                'description' => 'Coordinates staff deployment and field assignments.',
            ],
        ];
    }

    /**
     * @return array<int, array<string, string>>
     */
    private function designations(): array
    {
        return [
            ['name' => 'Managing Director', 'code' => 'MD', 'description' => 'Executive leadership role.'],
            ['name' => 'HR Director', 'code' => 'HRD', 'description' => 'Leads HR strategy and people operations.'],
            ['name' => 'HR Officer', 'code' => 'HRO', 'description' => 'Handles day-to-day HR administration.'],
            ['name' => 'Department Head', 'code' => 'DH', 'description' => 'Leads a department or business function.'],
            ['name' => 'Supervisor', 'code' => 'SUP', 'description' => 'Supervises team members and approvals.'],
            ['name' => 'Officer', 'code' => 'OFF', 'description' => 'General officer-level staff role.'],
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function gradeLevels(): array
    {
        return [
            ['name' => 'Grade Level 01', 'code' => 'GL01', 'rank' => 1, 'description' => 'Entry support grade.'],
            ['name' => 'Grade Level 02', 'code' => 'GL02', 'rank' => 2, 'description' => 'Junior support grade.'],
            ['name' => 'Grade Level 03', 'code' => 'GL03', 'rank' => 3, 'description' => 'Officer entry grade.'],
            ['name' => 'Grade Level 04', 'code' => 'GL04', 'rank' => 4, 'description' => 'Officer grade.'],
            ['name' => 'Grade Level 05', 'code' => 'GL05', 'rank' => 5, 'description' => 'Senior officer grade.'],
            ['name' => 'Grade Level 06', 'code' => 'GL06', 'rank' => 6, 'description' => 'Managerial grade.'],
            ['name' => 'Grade Level 07', 'code' => 'GL07', 'rank' => 7, 'description' => 'Senior managerial grade.'],
        ];
    }

    /**
     * @return array<int, array<string, string>>
     */
    private function employmentTypes(): array
    {
        return [
            ['name' => 'Permanent', 'code' => 'PERM', 'description' => 'Permanent employment.'],
            ['name' => 'Contract', 'code' => 'CONT', 'description' => 'Fixed-term contract employment.'],
            ['name' => 'Temporary', 'code' => 'TEMP', 'description' => 'Temporary employment.'],
            ['name' => 'Intern', 'code' => 'INT', 'description' => 'Internship or trainee engagement.'],
            ['name' => 'Consultant', 'code' => 'CONS', 'description' => 'Consultant or advisory engagement.'],
        ];
    }
}
