<?php

namespace Tests\Feature\Documents;

use App\Models\DocumentRequirement;
use App\Models\DocumentType;
use App\Models\Employee;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class DocumentComplianceTest extends TestCase
{
    use RefreshDatabase;

    public function test_hr_admin_can_create_document_type_and_requirement(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        Sanctum::actingAs($admin);

        $typeId = $this->postJson('/api/documents/types', [
            'name' => 'Medical Certificate',
            'code' => 'med-cert',
            'description' => 'Medical fitness certificate.',
            'requires_expiry_date' => true,
            'default_reminder_days' => 30,
            'employee_upload_allowed' => true,
            'approval_required' => true,
        ])
            ->assertCreated()
            ->assertJsonPath('data.code', 'MED-CERT')
            ->assertJsonPath('data.requires_expiry_date', true)
            ->json('data.id');

        $this->postJson('/api/documents/requirements', [
            'document_type_id' => $typeId,
            'name' => 'Medical certificate for all employees',
            'description' => 'Required during onboarding.',
            'is_required' => true,
            'employee_upload_allowed' => true,
            'approval_required' => true,
            'reminder_days' => 30,
        ])
            ->assertCreated()
            ->assertJsonPath('data.name', 'Medical certificate for all employees')
            ->assertJsonPath('data.document_type.code', 'MED-CERT');
    }

    public function test_employee_can_submit_own_required_document(): void
    {
        $this->seed();

        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        $type = DocumentType::query()->where('organization_id', $employeeUser->organization_id)->where('code', 'GOV-ID')->firstOrFail();
        $requirement = DocumentRequirement::query()
            ->where('organization_id', $employeeUser->organization_id)
            ->where('document_type_id', $type->id)
            ->firstOrFail();

        Sanctum::actingAs($employeeUser);

        $this->postJson('/api/documents', [
            'document_type_id' => $type->id,
            'document_requirement_id' => $requirement->id,
            'title' => 'Aisha Government ID',
            'file_name' => 'aisha-government-id.pdf',
            'file_path' => 'uploads/aisha-government-id.pdf',
            'mime_type' => 'application/pdf',
            'file_size' => 150000,
            'issued_at' => '2025-01-01',
            'expires_at' => '2028-01-01',
            'notes' => 'Submitted during onboarding.',
        ])
            ->assertCreated()
            ->assertJsonPath('document.employee.employee_number', 'EMP-FIN-001')
            ->assertJsonPath('document.document_type.code', 'GOV-ID')
            ->assertJsonPath('document.status', 'submitted');
    }

    public function test_hr_admin_can_review_employee_document(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $employee = Employee::query()->where('employee_number', 'EMP-FIN-001')->firstOrFail();
        $type = DocumentType::query()->where('organization_id', $admin->organization_id)->where('code', 'GOV-ID')->firstOrFail();
        $requirement = DocumentRequirement::query()
            ->where('organization_id', $admin->organization_id)
            ->where('document_type_id', $type->id)
            ->firstOrFail();

        Sanctum::actingAs($admin);

        $documentId = $this->postJson('/api/documents', [
            'employee_id' => $employee->id,
            'document_type_id' => $type->id,
            'document_requirement_id' => $requirement->id,
            'title' => 'Aisha Government ID',
            'file_name' => 'aisha-government-id.pdf',
            'file_path' => 'uploads/aisha-government-id.pdf',
            'expires_at' => '2028-01-01',
        ])
            ->assertCreated()
            ->json('document.id');

        $this->patchJson("/api/documents/{$documentId}/review", [
            'action' => 'approve',
            'note' => 'Verified against original.',
        ])
            ->assertOk()
            ->assertJsonPath('document.status', 'approved')
            ->assertJsonPath('document.review_note', 'Verified against original.')
            ->assertJsonPath('document.reviews.0.action', 'approve');
    }

    public function test_compliance_summary_reports_missing_documents(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        Sanctum::actingAs($admin);

        $this->getJson('/api/documents/compliance')
            ->assertOk()
            ->assertJsonPath('summary.employees_checked', 7)
            ->assertJsonPath('summary.requirements_checked', 3)
            ->assertJsonStructure([
                'summary' => ['missing', 'expired', 'expiring_soon', 'submitted', 'approved'],
                'data' => [
                    '*' => ['employee', 'requirement', 'state', 'document'],
                ],
            ]);
    }

    public function test_employee_cannot_create_document_type(): void
    {
        $this->seed();

        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        Sanctum::actingAs($employeeUser);

        $this->postJson('/api/documents/types', [
            'name' => 'Unauthorized Type',
            'code' => 'UNAUTH',
        ])
            ->assertForbidden();
    }
}
