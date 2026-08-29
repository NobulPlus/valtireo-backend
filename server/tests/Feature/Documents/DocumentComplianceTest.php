<?php

namespace Tests\Feature\Documents;

use App\Models\ApprovalRequest;
use App\Models\DocumentRequirement;
use App\Models\DocumentType;
use App\Models\Employee;
use App\Models\EmployeeDocument;
use App\Models\User;
use App\Notifications\ValtireoNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Notification;
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

    public function test_failed_document_business_validation_removes_uploaded_file(): void
    {
        Storage::fake('local');
        $this->seed();

        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        $type = DocumentType::query()->create([
            'organization_id' => $employeeUser->organization_id,
            'name' => 'Expiry Controlled Document',
            'code' => 'EXP-CONTROL',
            'requires_expiry_date' => true,
            'employee_upload_allowed' => true,
            'approval_required' => false,
            'is_active' => true,
        ]);

        Sanctum::actingAs($employeeUser);

        $this->post('/api/documents', [
            'document_type_id' => $type->id,
            'title' => 'Missing Expiry Document',
            'file' => UploadedFile::fake()->create('missing-expiry.pdf', 128, 'application/pdf'),
        ], ['Accept' => 'application/json'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['expires_at']);

        $this->assertSame([], Storage::disk('local')->allFiles());
        $this->assertDatabaseMissing('employee_documents', ['title' => 'Missing Expiry Document']);
    }

    public function test_failed_signed_copy_business_validation_removes_uploaded_file(): void
    {
        Storage::fake('local');
        $this->seed();

        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        $employee = $employeeUser->employee;
        $type = DocumentType::query()->where('organization_id', $employeeUser->organization_id)->where('code', 'EMP-CONTRACT')->firstOrFail();
        $document = EmployeeDocument::query()->create([
            'organization_id' => $employeeUser->organization_id,
            'employee_id' => $employee->id,
            'document_type_id' => $type->id,
            'title' => 'Already Approved Contract',
            'file_name' => 'contract.pdf',
            'file_path' => 'test/contract.pdf',
            'status' => 'approved',
            'submitted_at' => now(),
        ]);

        Sanctum::actingAs($employeeUser);

        $this->post("/api/documents/{$document->id}/signed-copy", [
            'file' => UploadedFile::fake()->create('signed-contract.pdf', 128, 'application/pdf'),
        ], ['Accept' => 'application/json'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['replaces_document_id']);

        $this->assertSame([], Storage::disk('local')->allFiles());
        $this->assertDatabaseMissing('employee_documents', ['title' => 'Already Approved Contract (signed)']);
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
            ->assertJsonPath('summary.employees_checked', 47)
            ->assertJsonPath('summary.requirements_checked', 3)
            ->assertJsonStructure([
                'summary' => ['missing', 'expired', 'expiring_soon', 'submitted', 'approved'],
                'data' => [
                    '*' => ['employee', 'requirement', 'state', 'document'],
                ],
            ]);
    }

    public function test_employee_can_acknowledge_a_document_hr_uploaded_for_them(): void
    {
        Storage::fake('local');
        Notification::fake();
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();

        // A test-scoped type, not a seeded one — this test is about the
        // acknowledge mechanism itself, not any particular seeded type's
        // current configuration.
        $type = DocumentType::query()->create([
            'organization_id' => $admin->organization_id,
            'name' => 'Policy Acknowledgement',
            'code' => 'POLICY-ACK-'.uniqid(),
            'requires_expiry_date' => false,
            'default_reminder_days' => 30,
            'employee_upload_allowed' => false,
            'approval_required' => false,
            'signature_method' => 'acknowledge',
            'is_active' => true,
        ]);

        Sanctum::actingAs($admin);

        $documentId = $this->post('/api/documents', [
            'employee_id' => $employeeUser->employee->id,
            'document_type_id' => $type->id,
            'title' => 'Aisha Policy Acknowledgement',
            'file' => UploadedFile::fake()->create('aisha-policy.pdf', 128, 'application/pdf'),
        ], ['Accept' => 'application/json'])
            ->assertCreated()
            // HR-provided documents aren't routed through the approval workflow —
            // HR uploading it is the authoritative action.
            ->assertJsonPath('document.status', 'approved')
            ->assertJsonPath('document.document_type.signature_method', 'acknowledge')
            ->assertJsonPath('document.acknowledged_at', null)
            ->json('document.id');

        Notification::assertSentTo(
            $employeeUser,
            ValtireoNotification::class,
            fn ($notification) => $notification->toArray($employeeUser)['event'] === 'document.needs_acknowledgment'
        );

        Sanctum::actingAs($employeeUser);

        $this->patchJson("/api/documents/{$documentId}/acknowledge")
            ->assertOk()
            ->assertJsonPath('document.acknowledged_at', fn ($value) => filled($value));

        $this->assertNotNull(EmployeeDocument::query()->findOrFail($documentId)->acknowledged_at);

        Notification::assertSentTo(
            $admin,
            ValtireoNotification::class,
            fn ($notification) => $notification->toArray($admin)['event'] === 'document.acknowledged'
        );

        // Acknowledging twice is a no-op error, not a silent success.
        $this->patchJson("/api/documents/{$documentId}/acknowledge")
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['status']);
    }

    public function test_signed_copy_flow_from_hr_upload_to_hr_approval(): void
    {
        Storage::fake('local');
        Notification::fake();
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        $type = DocumentType::query()
            ->where('organization_id', $admin->organization_id)
            ->where('code', 'GUARANTOR')
            ->firstOrFail();

        $this->assertSame('signed_copy', $type->signature_method);

        Sanctum::actingAs($admin);

        // HR uploads the blank form for the employee to sign.
        $originalId = $this->post('/api/documents', [
            'employee_id' => $employeeUser->employee->id,
            'document_type_id' => $type->id,
            'title' => 'Aisha Guarantor Form',
            'file' => UploadedFile::fake()->create('guarantor-blank.pdf', 64, 'application/pdf'),
        ], ['Accept' => 'application/json'])
            ->assertCreated()
            ->assertJsonPath('document.status', 'awaiting_signature')
            ->json('document.id');

        Notification::assertSentTo(
            $employeeUser,
            ValtireoNotification::class,
            fn ($notification) => $notification->toArray($employeeUser)['event'] === 'document.needs_signature'
        );

        // Nothing to review yet — the employee hasn't signed anything. An
        // approval task here would just be HR being asked to review their
        // own upload of a blank form.
        $this->assertDatabaseMissing('approval_requests', [
            'approvable_type' => EmployeeDocument::class,
            'approvable_id' => $originalId,
        ]);

        // An employee cannot self-upload this type from scratch (only reply to the request).
        Sanctum::actingAs($employeeUser);
        $this->postJson('/api/documents', [
            'document_type_id' => $type->id,
            'title' => 'Self-uploaded guarantor form',
            'file' => UploadedFile::fake()->create('guarantor-fresh.pdf', 64, 'application/pdf'),
        ], ['Accept' => 'application/json'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['document_type_id']);

        // Employee uploads the signed copy against the original.
        $signedId = $this->post("/api/documents/{$originalId}/signed-copy", [
            'file' => UploadedFile::fake()->create('guarantor-signed.pdf', 64, 'application/pdf'),
        ], ['Accept' => 'application/json'])
            ->assertCreated()
            ->assertJsonPath('document.status', 'submitted')
            ->assertJsonPath('document.replaces_document_id', $originalId)
            ->json('document.id');

        $this->assertSame('superseded', EmployeeDocument::query()->findOrFail($originalId)->status);

        // Only the owning employee can reply to their own request.
        $otherEmployeeUser = User::factory()->create(['organization_id' => $admin->organization_id]);
        Sanctum::actingAs($otherEmployeeUser);
        $this->post("/api/documents/{$originalId}/signed-copy", [
            'file' => UploadedFile::fake()->create('not-mine.pdf', 64, 'application/pdf'),
        ], ['Accept' => 'application/json'])->assertForbidden();

        // HR can see the actual signed file from the approval request itself,
        // not just its title — not blind-approving a signature.
        Sanctum::actingAs($admin);
        $approval = ApprovalRequest::query()->where('approvable_type', EmployeeDocument::class)->where('approvable_id', $signedId)->firstOrFail();
        $this->getJson("/api/approvals/{$approval->id}")
            ->assertOk()
            ->assertJsonPath('data.document.id', $signedId)
            ->assertJsonPath('data.document.view_url', fn ($url) => str_contains($url, "/api/documents/{$signedId}/view"));

        // HR reviews the signed copy like any other submitted document.
        $this->patchJson("/api/documents/{$signedId}/review", ['action' => 'approve'])
            ->assertOk()
            ->assertJsonPath('document.status', 'approved');

        $this->assertSame('approved', EmployeeDocument::query()->findOrFail($signedId)->status);

        // The employee (who has no approvals.view permission) gets notified
        // the decision landed, but pointed at her own documents tab — not a
        // link to the Approvals page she can't open.
        Notification::assertSentTo(
            $employeeUser,
            ValtireoNotification::class,
            fn ($notification) => $notification->toArray($employeeUser)['event'] === 'approval.decided'
                && $notification->toArray($employeeUser)['action_url'] === '/me/profile?tab=documents'
        );
    }

    public function test_no_acknowledgment_notification_when_employee_uploads_their_own_document(): void
    {
        Storage::fake('local');
        Notification::fake();
        $this->seed();

        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        $type = DocumentType::query()
            ->where('organization_id', $employeeUser->organization_id)
            ->where('code', 'GOV-ID')
            ->firstOrFail();

        Sanctum::actingAs($employeeUser);

        $this->post('/api/documents', [
            'document_type_id' => $type->id,
            'title' => 'Aisha Government ID',
            'file' => UploadedFile::fake()->create('aisha-id.pdf', 128, 'application/pdf'),
            'expires_at' => now()->addYear()->toDateString(),
        ], ['Accept' => 'application/json'])->assertCreated();

        Notification::assertNothingSentTo($employeeUser);
    }

    public function test_employee_cannot_upload_the_signed_contract_type_themselves(): void
    {
        Storage::fake('local');
        $this->seed();

        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        $type = DocumentType::query()
            ->where('organization_id', $employeeUser->organization_id)
            ->where('code', 'EMP-CONTRACT')
            ->firstOrFail();

        Sanctum::actingAs($employeeUser);

        $this->postJson('/api/documents', [
            'document_type_id' => $type->id,
            'title' => 'Self-uploaded contract',
            'file' => UploadedFile::fake()->create('contract.pdf', 128, 'application/pdf'),
        ], ['Accept' => 'application/json'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['document_type_id']);
    }

    public function test_employees_own_document_type_picker_hides_hr_only_types(): void
    {
        $this->seed();

        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        Sanctum::actingAs($employeeUser);

        $codes = collect($this->getJson('/api/documents/types?per_page=50')->assertOk()->json('data'))
            ->pluck('code');

        $this->assertTrue($codes->contains('GOV-ID'));
        $this->assertFalse($codes->contains('EMP-CONTRACT'));
    }

    public function test_cannot_acknowledge_someone_elses_document(): void
    {
        Storage::fake('local');
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $employee = Employee::query()->where('employee_number', 'EMP-FIN-001')->firstOrFail();
        $type = DocumentType::query()
            ->where('organization_id', $admin->organization_id)
            ->where('code', 'EMP-CONTRACT')
            ->firstOrFail();

        Sanctum::actingAs($admin);

        $documentId = $this->post('/api/documents', [
            'employee_id' => $employee->id,
            'document_type_id' => $type->id,
            'title' => 'Contract',
            'file' => UploadedFile::fake()->create('contract.pdf', 128, 'application/pdf'),
        ], ['Accept' => 'application/json'])->assertCreated()->json('document.id');

        $otherEmployeeUser = User::query()->where('email', 'nnamdi.uzoma@valtireo.test')->first()
            ?? User::factory()->create(['organization_id' => $admin->organization_id]);

        Sanctum::actingAs($otherEmployeeUser);

        $this->patchJson("/api/documents/{$documentId}/acknowledge")->assertForbidden();
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
