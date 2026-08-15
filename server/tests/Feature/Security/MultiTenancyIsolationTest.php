<?php

namespace Tests\Feature\Security;

use App\Models\ApprovalRequest;
use App\Models\ApprovalWorkflow;
use App\Models\Department;
use App\Models\Designation;
use App\Models\DocumentType;
use App\Models\Employee;
use App\Models\EmployeeCustomField;
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

class MultiTenancyIsolationTest extends TestCase
{
    use RefreshDatabase;

    public function test_tenant_users_cannot_view_records_from_another_organization(): void
    {
        $this->seed();

        $tenantAAdmin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $tenantB = $this->createTenantFixture();

        Sanctum::actingAs($tenantAAdmin);

        $this->getJson("/api/employees/{$tenantB['employee']->id}")
            ->assertNotFound();
        $this->getJson("/api/documents/{$tenantB['document']->id}")
            ->assertNotFound();
        $this->getJson("/api/employee-profile/custom-fields/{$tenantB['custom_field']->id}")
            ->assertNotFound();
        $this->getJson("/api/approval-workflows/{$tenantB['workflow']->id}")
            ->assertNotFound();
        $this->getJson("/api/approvals/{$tenantB['approval_request']->id}")
            ->assertNotFound();

        $this->getJson('/api/employees')
            ->assertOk()
            ->assertJsonMissing(['work_email' => 'employee@beta.test']);
        $this->getJson('/api/documents')
            ->assertOk()
            ->assertJsonMissing(['title' => 'Beta Confidential Document']);
        $this->getJson('/api/approval-workflows')
            ->assertOk()
            ->assertJsonMissing(['name' => 'Beta Custom Workflow']);
        $this->getJson('/api/approvals')
            ->assertOk()
            ->assertJsonMissing(['title' => 'Beta Approval Request']);
    }

    public function test_tenant_users_cannot_modify_records_from_another_organization(): void
    {
        $this->seed();

        $tenantAAdmin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $tenantB = $this->createTenantFixture();

        Sanctum::actingAs($tenantAAdmin);

        $this->putJson("/api/employees/{$tenantB['employee']->id}/custom-field-values", [
            'values' => [
                ['field_id' => $tenantB['custom_field']->id, 'value' => 'SHOULD-NOT-SAVE'],
            ],
        ])
            ->assertNotFound();

        $this->patchJson("/api/approval-workflows/{$tenantB['workflow']->id}", [
            'name' => 'Tampered Workflow',
        ])
            ->assertNotFound();

        $this->postJson("/api/approvals/{$tenantB['approval_request']->id}/actions", [
            'action' => 'approve',
            'note' => 'Cross-tenant approval attempt.',
        ])
            ->assertNotFound();

        $this->patchJson("/api/documents/{$tenantB['document']->id}/review", [
            'action' => 'approve',
            'note' => 'Cross-tenant review attempt.',
        ])
            ->assertNotFound();

        $this->assertDatabaseMissing('employee_custom_field_values', [
            'employee_id' => $tenantB['employee']->id,
            'value' => 'SHOULD-NOT-SAVE',
        ]);
        $this->assertDatabaseHas('approval_workflows', [
            'id' => $tenantB['workflow']->id,
            'name' => 'Beta Custom Workflow',
        ]);
        $this->assertDatabaseHas('approval_requests', [
            'id' => $tenantB['approval_request']->id,
            'status' => 'pending',
        ]);
        $this->assertDatabaseHas('employee_documents', [
            'id' => $tenantB['document']->id,
            'status' => 'submitted',
        ]);
    }

    public function test_tenant_validation_rejects_structure_ids_from_another_organization(): void
    {
        $this->seed();

        $tenantAAdmin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $tenantB = $this->createTenantFixture();

        Sanctum::actingAs($tenantAAdmin);

        $this->postJson('/api/employees', [
            'employee_number' => 'CROSS-001',
            'first_name' => 'Cross',
            'last_name' => 'Tenant',
            'work_email' => 'cross-tenant@example.test',
            'department_id' => $tenantB['department']->id,
            'unit_id' => $tenantB['unit']->id,
            'designation_id' => $tenantB['designation']->id,
            'grade_level_id' => $tenantB['grade_level']->id,
            'employment_type_id' => $tenantB['employment_type']->id,
            'organization_location_id' => $tenantB['location']->id,
            'start_date' => '2026-08-10',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors([
                'department_id',
                'unit_id',
                'designation_id',
                'grade_level_id',
                'employment_type_id',
                'organization_location_id',
            ]);
    }

    public function test_employee_work_email_uniqueness_is_scoped_to_the_organization(): void
    {
        $this->seed();

        $tenantAAdmin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $tenantB = $this->createTenantFixture();
        $tenantAEmployee = Employee::query()
            ->where('organization_id', $tenantAAdmin->organization_id)
            ->where('employee_number', 'EMP-FIN-001')
            ->firstOrFail();

        Sanctum::actingAs($tenantAAdmin);

        $this->patchJson("/api/employees/{$tenantAEmployee->id}", [
            'work_email' => $tenantB['employee']->work_email,
        ])->assertOk();

        $this->assertDatabaseHas('employees', [
            'id' => $tenantAEmployee->id,
            'work_email' => $tenantB['employee']->work_email,
        ]);
    }

    public function test_setup_lookups_and_workspace_settings_are_scoped_to_logged_in_organization(): void
    {
        $this->seed();

        $tenantAAdmin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $tenantB = $this->createTenantFixture();

        Sanctum::actingAs($tenantAAdmin);

        $this->getJson('/api/setup/departments')
            ->assertOk()
            ->assertJsonMissing(['code' => 'BETA-HR'])
            ->assertJsonMissing(['name' => 'Beta Human Resources']);

        $this->getJson('/api/workspace')
            ->assertOk()
            ->assertJsonPath('workspace.workspace_code', 'VALTIREO')
            ->assertJsonMissing(['workspace_code' => 'BETA']);

        $this->patchJson('/api/workspace/settings', [
            'identity' => [
                'welcome_message' => 'Updated only for Valtireo.',
            ],
        ])
            ->assertOk()
            ->assertJsonPath('workspace.identity.welcome_message', 'Updated only for Valtireo.');

        $this->assertSame(
            'Welcome to Beta.',
            $tenantB['organization']->refresh()->settings['identity']['welcome_message']
        );
    }

    /**
     * @return array<string, mixed>
     */
    private function createTenantFixture(): array
    {
        $organization = Organization::factory()->create([
            'name' => 'Beta Organization',
            'code' => 'BETA',
            'settings' => [
                'identity' => [
                    'welcome_message' => 'Welcome to Beta.',
                ],
            ],
        ]);
        $admin = User::factory()->create([
            'organization_id' => $organization->id,
            'name' => 'Beta Admin',
            'email' => 'admin@beta.test',
        ]);
        $admin->assignRole('Organization Admin');

        $location = OrganizationLocation::factory()->create([
            'organization_id' => $organization->id,
            'name' => 'Beta Main Office',
            'code' => 'BETA-MAIN',
            'is_primary' => true,
            'is_active' => true,
        ]);
        $department = Department::factory()->create([
            'organization_id' => $organization->id,
            'name' => 'Beta Human Resources',
            'code' => 'BETA-HR',
            'is_active' => true,
        ]);
        $unit = Unit::factory()->create([
            'organization_id' => $organization->id,
            'department_id' => $department->id,
            'name' => 'Beta Records',
            'code' => 'BETA-REC',
            'is_active' => true,
        ]);
        $designation = Designation::factory()->create([
            'organization_id' => $organization->id,
            'name' => 'Beta Officer',
            'code' => 'BETA-OFF',
            'is_active' => true,
        ]);
        $gradeLevel = GradeLevel::factory()->create([
            'organization_id' => $organization->id,
            'name' => 'Beta Grade 1',
            'code' => 'BETA-GL1',
            'rank' => 1,
            'is_active' => true,
        ]);
        $employmentType = EmploymentType::factory()->create([
            'organization_id' => $organization->id,
            'name' => 'Beta Permanent',
            'code' => 'BETA-PERM',
            'is_active' => true,
        ]);
        $employee = Employee::factory()->create([
            'organization_id' => $organization->id,
            'employee_number' => 'BETA-EMP-001',
            'first_name' => 'Beta',
            'last_name' => 'Employee',
            'work_email' => 'employee@beta.test',
            'department_id' => $department->id,
            'unit_id' => $unit->id,
            'designation_id' => $designation->id,
            'grade_level_id' => $gradeLevel->id,
            'employment_type_id' => $employmentType->id,
            'organization_location_id' => $location->id,
            'status' => 'active',
        ]);
        $documentType = DocumentType::query()->create([
            'organization_id' => $organization->id,
            'name' => 'Beta Confidential Type',
            'code' => 'BETA-CONF',
            'requires_expiry_date' => false,
            'default_reminder_days' => 30,
            'employee_upload_allowed' => true,
            'approval_required' => true,
            'is_active' => true,
        ]);
        $document = EmployeeDocument::query()->create([
            'organization_id' => $organization->id,
            'employee_id' => $employee->id,
            'document_type_id' => $documentType->id,
            'uploaded_by_id' => $admin->id,
            'title' => 'Beta Confidential Document',
            'file_name' => 'beta-confidential.pdf',
            'file_path' => 'uploads/beta-confidential.pdf',
            'status' => 'submitted',
            'submitted_at' => now(),
        ]);
        $customField = EmployeeCustomField::query()->create([
            'organization_id' => $organization->id,
            'name' => 'Beta Secret Field',
            'key' => 'beta_secret_field',
            'type' => 'text',
            'visible_to_employee' => true,
            'editable_by_employee' => false,
            'is_active' => true,
        ]);
        $workflow = ApprovalWorkflow::query()->create([
            'organization_id' => $organization->id,
            'module' => 'employee_documents',
            'action' => 'submit',
            'name' => 'Beta Custom Workflow',
            'is_active' => true,
        ]);
        $workflow->steps()->create([
            'step_order' => 1,
            'name' => 'Beta HR Review',
            'approver_type' => 'permission',
            'approver_permission' => 'employee_documents.update',
            'is_active' => true,
        ]);
        $approvalRequest = ApprovalRequest::query()->create([
            'organization_id' => $organization->id,
            'approval_workflow_id' => $workflow->id,
            'requester_id' => $admin->id,
            'subject_employee_id' => $employee->id,
            'approvable_type' => EmployeeDocument::class,
            'approvable_id' => $document->id,
            'module' => 'employee_documents',
            'action' => 'submit',
            'title' => 'Beta Approval Request',
            'status' => 'pending',
            'current_step_order' => 1,
            'submitted_at' => now(),
        ]);

        return [
            'organization' => $organization,
            'admin' => $admin,
            'location' => $location,
            'department' => $department,
            'unit' => $unit,
            'designation' => $designation,
            'grade_level' => $gradeLevel,
            'employment_type' => $employmentType,
            'employee' => $employee,
            'document' => $document,
            'custom_field' => $customField,
            'workflow' => $workflow,
            'approval_request' => $approvalRequest,
        ];
    }
}
