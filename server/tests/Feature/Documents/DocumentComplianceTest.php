<?php

namespace Tests\Feature\Documents;

use App\Models\DocumentRequirement;
use App\Models\DocumentType;
use App\Models\Employee;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
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

    public function test_hr_admin_can_update_document_requirement(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $requirement = DocumentRequirement::query()
            ->where('organization_id', $admin->organization_id)
            ->firstOrFail();

        Sanctum::actingAs($admin);

        $this->patchJson("/api/documents/requirements/{$requirement->id}", [
            'name' => 'Updated onboarding document requirement',
            'is_required' => true,
            'employee_upload_allowed' => false,
            'approval_required' => true,
            'is_active' => false,
        ])
            ->assertOk()
            ->assertJsonPath('data.name', 'Updated onboarding document requirement')
            ->assertJsonPath('data.employee_upload_allowed', false)
            ->assertJsonPath('data.approval_required', true)
            ->assertJsonPath('data.is_active', false);
    }

    public function test_employee_can_submit_own_required_document(): void
    {
        Storage::fake('local');
        $this->seed();

        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        $type = DocumentType::query()->where('organization_id', $employeeUser->organization_id)->where('code', 'GOV-ID')->firstOrFail();
        $requirement = DocumentRequirement::query()
            ->where('organization_id', $employeeUser->organization_id)
            ->where('document_type_id', $type->id)
            ->firstOrFail();

        Sanctum::actingAs($employeeUser);

        $this->post('/api/documents', [
            'document_type_id' => $type->id,
            'document_requirement_id' => $requirement->id,
            'title' => 'Aisha Government ID',
            'file' => UploadedFile::fake()->create('aisha-government-id.pdf', 128, 'application/pdf'),
            'issued_at' => '2025-01-01',
            'expires_at' => '2028-01-01',
            'notes' => 'Submitted during onboarding.',
        ], ['Accept' => 'application/json'])
            ->assertCreated()
            ->assertJsonPath('document.employee.employee_number', 'EMP-FIN-001')
            ->assertJsonPath('document.document_type.code', 'GOV-ID')
            ->assertJsonPath('document.status', 'submitted');
    }

    public function test_document_submission_requires_a_real_file_and_rejects_a_fabricated_path(): void
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
            'title' => 'Fabricated ID',
            'file_name' => 'fabricated.pdf',
            'file_path' => 'uploads/fabricated.pdf',
            'mime_type' => 'application/pdf',
            'file_size' => 150000,
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['file']);

        $this->assertDatabaseMissing('employee_documents', ['title' => 'Fabricated ID']);
    }

    public function test_employee_can_upload_and_download_own_document_file(): void
    {
        Storage::fake('local');
        $this->seed();

        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        $type = DocumentType::query()->where('organization_id', $employeeUser->organization_id)->where('code', 'GOV-ID')->firstOrFail();
        $requirement = DocumentRequirement::query()
            ->where('organization_id', $employeeUser->organization_id)
            ->where('document_type_id', $type->id)
            ->firstOrFail();

        Sanctum::actingAs($employeeUser);

        $documentId = $this->post('/api/documents', [
            'document_type_id' => $type->id,
            'document_requirement_id' => $requirement->id,
            'title' => 'Aisha Government ID File',
            'file' => UploadedFile::fake()->create('aisha-government-id.pdf', 128, 'application/pdf'),
            'issued_at' => '2025-01-01',
            'expires_at' => '2028-01-01',
        ], ['Accept' => 'application/json'])
            ->assertCreated()
            ->assertJsonPath('document.file_name', 'aisha-government-id.pdf')
            ->assertJsonPath('document.mime_type', 'application/pdf')
            ->assertJsonStructure(['document' => ['download_url', 'view_url']])
            ->json('document.id');

        $document = \App\Models\EmployeeDocument::query()->findOrFail($documentId);
        Storage::disk('local')->assertExists($document->file_path);

        $this->get("/api/documents/{$documentId}/download")
            ->assertOk()
            ->assertDownload('aisha-government-id.pdf');

        $this->get("/api/documents/{$documentId}/view")
            ->assertOk()
            ->assertHeader('content-type', 'application/pdf');
    }

    public function test_hr_admin_can_review_employee_document(): void
    {
        Storage::fake('local');
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $employee = Employee::query()->where('employee_number', 'EMP-FIN-001')->firstOrFail();
        $type = DocumentType::query()->where('organization_id', $admin->organization_id)->where('code', 'GOV-ID')->firstOrFail();
        $requirement = DocumentRequirement::query()
            ->where('organization_id', $admin->organization_id)
            ->where('document_type_id', $type->id)
            ->firstOrFail();

        Sanctum::actingAs($admin);

        $documentId = $this->post('/api/documents', [
            'employee_id' => $employee->id,
            'document_type_id' => $type->id,
            'document_requirement_id' => $requirement->id,
            'title' => 'Aisha Government ID',
            'file' => UploadedFile::fake()->create('aisha-government-id.pdf', 128, 'application/pdf'),
            'expires_at' => '2028-01-01',
        ], ['Accept' => 'application/json'])
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
