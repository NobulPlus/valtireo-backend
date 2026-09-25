<?php

namespace Tests\Feature\Employees;

use App\Models\Department;
use App\Models\Designation;
use App\Models\DocumentRequirement;
use App\Models\Employee;
use App\Models\EmployeeDocument;
use App\Models\EmploymentType;
use App\Models\GradeLevel;
use App\Models\Organization;
use App\Models\OrganizationLocation;
use App\Models\Unit;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class EmployeeOnboardingApprovalTest extends TestCase
{
    use RefreshDatabase;

    public function test_hr_admin_can_approve_submitted_employee_onboarding(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        Sanctum::actingAs($admin);

        $employee = $this->createOnboardingEmployee();
        $employee->profile()->update([
            'completion_status' => 'submitted',
        ]);

        $this->patchJson("/api/employees/{$employee->id}/approve-onboarding", ['confirmation_status' => 'confirmed'])
            ->assertOk()
            ->assertJsonPath('employee.status', 'active')
            ->assertJsonPath('employee.confirmation_status', 'confirmed')
            ->assertJsonPath('profile.completion_status', 'approved')
            ->assertJsonPath('employee.onboarding_completed_at', fn ($value) => filled($value))
            ->assertJsonPath('employee.activated_at', fn ($value) => filled($value));

        $this->assertDatabaseHas('employees', [
            'id' => $employee->id,
            'status' => 'active',
            'confirmation_status' => 'confirmed',
        ]);

        $this->assertDatabaseHas('employee_profiles', [
            'employee_id' => $employee->id,
            'completion_status' => 'approved',
        ]);

        $this->assertDatabaseHas('employee_status_histories', [
            'employee_id' => $employee->id,
            'previous_status' => 'onboarding',
            'new_status' => 'active',
            'previous_confirmation_status' => 'not_applicable',
            'new_confirmation_status' => 'confirmed',
        ]);
    }

    public function test_hr_admin_can_approve_onboarding_directly_to_probation_with_a_review_date(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        Sanctum::actingAs($admin);

        $employee = $this->createOnboardingEmployee([
            'employee_number' => 'EMP-APPROVE-006',
            'work_email' => 'approval-probation@valtireo.test',
        ]);
        $employee->profile()->update(['completion_status' => 'submitted']);

        $this->patchJson("/api/employees/{$employee->id}/approve-onboarding", [
            'confirmation_status' => 'probation',
            'probation_ends_at' => now()->addMonths(3)->toDateString(),
        ])
            ->assertOk()
            ->assertJsonPath('employee.status', 'active')
            ->assertJsonPath('employee.confirmation_status', 'probation');

        $this->assertDatabaseHas('employees', [
            'id' => $employee->id,
            'status' => 'active',
            'confirmation_status' => 'probation',
        ]);
    }

    public function test_probation_ends_at_is_required_when_approving_to_probation(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        Sanctum::actingAs($admin);

        $employee = $this->createOnboardingEmployee([
            'employee_number' => 'EMP-APPROVE-007',
            'work_email' => 'approval-probation-missing-date@valtireo.test',
        ]);
        $employee->profile()->update(['completion_status' => 'submitted']);

        $this->patchJson("/api/employees/{$employee->id}/approve-onboarding", ['confirmation_status' => 'probation'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['probation_ends_at']);
    }

    public function test_a_starting_stage_is_required_to_approve_onboarding(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        Sanctum::actingAs($admin);

        $employee = $this->createOnboardingEmployee([
            'employee_number' => 'EMP-APPROVE-008',
            'work_email' => 'approval-no-stage@valtireo.test',
        ]);
        $employee->profile()->update(['completion_status' => 'submitted']);

        $this->patchJson("/api/employees/{$employee->id}/approve-onboarding", [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['confirmation_status']);
    }

    public function test_only_probation_confirmed_or_not_applicable_are_valid_confirmation_statuses(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        Sanctum::actingAs($admin);

        $employee = $this->createOnboardingEmployee([
            'employee_number' => 'EMP-APPROVE-009',
            'work_email' => 'approval-invalid-stage@valtireo.test',
        ]);
        $employee->profile()->update(['completion_status' => 'submitted']);

        $this->patchJson("/api/employees/{$employee->id}/approve-onboarding", ['confirmation_status' => 'suspended'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['confirmation_status']);
    }

    public function test_employee_user_cannot_approve_onboarding(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        Sanctum::actingAs($admin);

        $employee = $this->createOnboardingEmployee([
            'employee_number' => 'EMP-APPROVE-002',
            'work_email' => 'approval-employee-user@valtireo.test',
        ]);
        $employee->profile()->update(['completion_status' => 'submitted']);

        $employeeUser = User::factory()->create([
            'organization_id' => $admin->organization_id,
        ]);
        $employeeUser->assignRole('Employee');

        Sanctum::actingAs($employeeUser);

        $this->patchJson("/api/employees/{$employee->id}/approve-onboarding", ['confirmation_status' => 'confirmed'])
            ->assertForbidden();
    }

    public function test_hr_admin_can_activate_onboarding_employee_with_already_approved_profile(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        Sanctum::actingAs($admin);

        $employee = $this->createOnboardingEmployee([
            'employee_number' => 'EMP-APPROVE-005',
            'work_email' => 'approval-already-approved@valtireo.test',
        ]);
        $employee->profile()->update(['completion_status' => 'approved']);

        $this->patchJson("/api/employees/{$employee->id}/approve-onboarding", ['confirmation_status' => 'not_applicable'])
            ->assertOk()
            ->assertJsonPath('employee.status', 'active')
            ->assertJsonPath('employee.confirmation_status', 'not_applicable')
            ->assertJsonPath('profile.completion_status', 'approved');
    }

    public function test_submitted_profile_is_required_before_approval(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        Sanctum::actingAs($admin);

        $employee = $this->createOnboardingEmployee([
            'employee_number' => 'EMP-APPROVE-003',
            'work_email' => 'approval-pending@valtireo.test',
        ]);

        $this->patchJson("/api/employees/{$employee->id}/approve-onboarding", ['confirmation_status' => 'confirmed'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['employee']);
    }

    public function test_onboarding_approval_requires_important_biodata(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        Sanctum::actingAs($admin);

        $response = $this->postJson('/api/employees', $this->payload([
            'employee_number' => 'EMP-APPROVE-011',
            'work_email' => 'approval-missing-biodata@valtireo.test',
        ]));
        $response->assertCreated();

        $employee = Employee::query()->findOrFail($response->json('employee.id'));
        $employee->update(['status' => 'onboarding']);
        $employee->profile()->update(['completion_status' => 'submitted']);
        $this->satisfyDocumentRequirements($employee);

        $this->patchJson("/api/employees/{$employee->id}/approve-onboarding", ['confirmation_status' => 'confirmed'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['employee'])
            ->assertJsonPath('errors.employee.0', 'Cannot activate employee. Important biodata is missing. Review the employee biodata before activation.');
    }

    public function test_onboarding_approval_is_blocked_by_a_missing_or_unsigned_required_document(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        Sanctum::actingAs($admin);

        // Deliberately skip satisfyDocumentRequirements() — nothing on file yet.
        $response = $this->postJson('/api/employees', $this->payload([
            'employee_number' => 'EMP-APPROVE-010',
            'work_email' => 'approval-missing-docs@valtireo.test',
        ]));
        $response->assertCreated();
        $employee = Employee::query()->findOrFail($response->json('employee.id'));
        $employee->update(['status' => 'onboarding']);
        $employee->profile()->update([
            'date_of_birth' => '1994-05-12',
            'gender' => 'female',
            'residential_address' => '24 Operations Street',
            'next_of_kin_name' => 'Grace Adeyemi',
            'next_of_kin_phone' => '08030000002',
        ]);
        $employee->emergencyContacts()->create([
            'organization_id' => $employee->organization_id,
            'name' => 'Grace Adeyemi',
            'relationship' => 'Sister',
            'phone' => '08030000003',
            'is_primary' => true,
        ]);
        $employee->profile()->update(['completion_status' => 'submitted']);

        $this->patchJson("/api/employees/{$employee->id}/approve-onboarding", ['confirmation_status' => 'confirmed'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['employee']);

        $this->assertDatabaseHas('employees', ['id' => $employee->id, 'status' => 'onboarding']);

        // Satisfying the contract but leaving it unsigned still blocks — the
        // HR-provided contract sits at "awaiting_signature" until the
        // employee's signed copy is reviewed and approved.
        $contractType = \App\Models\DocumentType::query()
            ->where('organization_id', $employee->organization_id)
            ->where('code', 'EMP-CONTRACT')
            ->firstOrFail();
        $contractRequirement = DocumentRequirement::query()
            ->where('organization_id', $employee->organization_id)
            ->where('document_type_id', $contractType->id)
            ->firstOrFail();
        $contractDocument = \App\Models\EmployeeDocument::query()->create([
            'organization_id' => $employee->organization_id,
            'employee_id' => $employee->id,
            'document_type_id' => $contractType->id,
            'document_requirement_id' => $contractRequirement->id,
            'title' => 'Employment Contract',
            'file_name' => 'contract.pdf',
            'file_path' => 'test/contract.pdf',
            'status' => 'awaiting_signature',
            'submitted_at' => now(),
        ]);
        $govIdType = \App\Models\DocumentType::query()
            ->where('organization_id', $employee->organization_id)
            ->where('code', 'GOV-ID')
            ->firstOrFail();
        $govIdRequirement = DocumentRequirement::query()
            ->where('organization_id', $employee->organization_id)
            ->where('document_type_id', $govIdType->id)
            ->firstOrFail();
        \App\Models\EmployeeDocument::query()->create([
            'organization_id' => $employee->organization_id,
            'employee_id' => $employee->id,
            'document_type_id' => $govIdType->id,
            'document_requirement_id' => $govIdRequirement->id,
            'title' => 'Government ID',
            'file_name' => 'id.pdf',
            'file_path' => 'test/id.pdf',
            'expires_at' => now()->addYear(),
            'status' => 'approved',
            'submitted_at' => now(),
        ]);

        $this->patchJson("/api/employees/{$employee->id}/approve-onboarding", ['confirmation_status' => 'confirmed'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['employee']);

        // Once the employee's signed copy is reviewed and approved, approval goes through.
        $contractDocument->update(['status' => 'approved']);

        $this->patchJson("/api/employees/{$employee->id}/approve-onboarding", ['confirmation_status' => 'confirmed'])
            ->assertOk()
            ->assertJsonPath('employee.status', 'active');
    }

    public function test_employee_must_be_in_onboarding_before_approval(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        Sanctum::actingAs($admin);

        $employee = $this->createOnboardingEmployee([
            'employee_number' => 'EMP-APPROVE-004',
            'work_email' => 'approval-draft@valtireo.test',
        ]);
        $employee->update(['status' => 'draft']);
        $employee->profile()->update(['completion_status' => 'submitted']);

        $this->patchJson("/api/employees/{$employee->id}/approve-onboarding", ['confirmation_status' => 'confirmed'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['employee']);
    }

    /**
     * @param array<string, mixed> $overrides
     */
    private function createOnboardingEmployee(array $overrides = []): Employee
    {
        $response = $this->postJson('/api/employees', $this->payload($overrides));

        $response->assertCreated();

        $employee = Employee::query()->findOrFail($response->json('employee.id'));
        $employee->update([
            'status' => 'onboarding',
        ]);
        $employee->profile()->update([
            'date_of_birth' => '1994-05-12',
            'gender' => 'female',
            'residential_address' => '24 Operations Street',
            'next_of_kin_name' => 'Grace Adeyemi',
            'next_of_kin_phone' => '08030000002',
        ]);
        $employee->emergencyContacts()->create([
            'organization_id' => $employee->organization_id,
            'name' => 'Grace Adeyemi',
            'relationship' => 'Sister',
            'phone' => '08030000003',
            'is_primary' => true,
        ]);

        $this->satisfyDocumentRequirements($employee);

        return $employee->refresh();
    }

    /**
     * Onboarding approval now blocks on any missing/expired/unacknowledged
     * required document (RichDemoDataSeeder seeds "Government ID for all
     * employees" and, for PERM employees, "Signed contract for permanent
     * employees"). Satisfy every requirement that actually applies to this
     * employee so these tests keep exercising the approval flow itself,
     * not the document gate.
     */
    private function satisfyDocumentRequirements(Employee $employee): void
    {
        $requirements = DocumentRequirement::query()
            ->where('organization_id', $employee->organization_id)
            ->where('is_active', true)
            ->where('is_required', true)
            ->where(fn ($query) => $query->whereNull('department_id')->orWhere('department_id', $employee->department_id))
            ->where(fn ($query) => $query->whereNull('designation_id')->orWhere('designation_id', $employee->designation_id))
            ->where(fn ($query) => $query->whereNull('grade_level_id')->orWhere('grade_level_id', $employee->grade_level_id))
            ->where(fn ($query) => $query->whereNull('employment_type_id')->orWhere('employment_type_id', $employee->employment_type_id))
            ->where(fn ($query) => $query->whereNull('organization_location_id')->orWhere('organization_location_id', $employee->organization_location_id))
            ->get();

        foreach ($requirements as $requirement) {
            EmployeeDocument::query()->create([
                'organization_id' => $employee->organization_id,
                'employee_id' => $employee->id,
                'document_type_id' => $requirement->document_type_id,
                'document_requirement_id' => $requirement->id,
                'title' => $requirement->name,
                'file_name' => 'document.pdf',
                'file_path' => 'test/document.pdf',
                'expires_at' => now()->addYear(),
                'status' => 'approved',
                'submitted_at' => now(),
                'reviewed_at' => now(),
                'acknowledged_at' => now(),
            ]);
        }
    }

    /**
     * @param array<string, mixed> $overrides
     *
     * @return array<string, mixed>
     */
    private function payload(array $overrides = []): array
    {
        $organization = Organization::query()->where('code', 'VALTIREO')->firstOrFail();
        $department = Department::query()->whereBelongsTo($organization)->where('code', 'HR')->firstOrFail();
        $unit = Unit::query()->whereBelongsTo($organization)->where('code', 'HR-REC')->firstOrFail();
        $designation = Designation::query()->whereBelongsTo($organization)->where('code', 'HRO')->firstOrFail();
        $gradeLevel = GradeLevel::query()->whereBelongsTo($organization)->where('code', 'GL03')->firstOrFail();
        $employmentType = EmploymentType::query()->whereBelongsTo($organization)->where('code', 'PERM')->firstOrFail();
        $location = OrganizationLocation::query()->whereBelongsTo($organization)->where('code', 'HQ')->firstOrFail();

        return [
            'employee_number' => 'EMP-APPROVE-001',
            'first_name' => 'Ada',
            'last_name' => 'Lovelace',
            'work_email' => 'approval@valtireo.test',
            'phone' => '08012345678',
            'department_id' => $department->id,
            'unit_id' => $unit->id,
            'designation_id' => $designation->id,
            'grade_level_id' => $gradeLevel->id,
            'employment_type_id' => $employmentType->id,
            'organization_location_id' => $location->id,
            'start_date' => '2026-08-02',
            'send_invitation' => false,
            ...$overrides,
        ];
    }
}
