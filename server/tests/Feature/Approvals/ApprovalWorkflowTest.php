<?php

namespace Tests\Feature\Approvals;

use App\Models\ApprovalRequest;
use App\Models\ApprovalWorkflow;
use App\Models\DocumentRequirement;
use App\Models\DocumentType;
use App\Models\Employee;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ApprovalWorkflowTest extends TestCase
{
    use RefreshDatabase;

    public function test_organization_admin_can_configure_approval_workflow_steps(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        Sanctum::actingAs($admin);

        $workflowId = $this->postJson('/api/approval-workflows', [
            'module' => 'leave',
            'action' => 'submit',
            'name' => 'Leave request approval',
            'description' => 'Manager then HR approval for leave.',
            'require_note_on_reject' => true,
            'steps' => [
                [
                    'step_order' => 1,
                    'name' => 'Direct manager approval',
                    'approver_type' => 'direct_manager',
                    'note_required' => false,
                ],
                [
                    'step_order' => 2,
                    'name' => 'HR approval',
                    'approver_type' => 'permission',
                    'approver_permission' => 'leave_requests.approve',
                    'note_required' => true,
                ],
            ],
        ])
            ->assertCreated()
            ->assertJsonPath('approval_workflow.module', 'leave')
            ->assertJsonPath('approval_workflow.steps.0.approver_type', 'direct_manager')
            ->assertJsonPath('approval_workflow.steps.1.approver_permission', 'leave_requests.approve')
            ->json('approval_workflow.id');

        $this->getJson("/api/approval-workflows/{$workflowId}")
            ->assertOk()
            ->assertJsonPath('data.steps.1.name', 'HR approval');
    }

    public function test_document_submission_creates_approval_request_and_review_decision(): void
    {
        $this->seed();

        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $type = DocumentType::query()->where('organization_id', $employeeUser->organization_id)->where('code', 'GOV-ID')->firstOrFail();
        $requirement = DocumentRequirement::query()
            ->where('organization_id', $employeeUser->organization_id)
            ->where('document_type_id', $type->id)
            ->firstOrFail();

        Sanctum::actingAs($employeeUser);

        $documentId = $this->postJson('/api/documents', [
            'document_type_id' => $type->id,
            'document_requirement_id' => $requirement->id,
            'title' => 'Aisha Government ID',
            'file_name' => 'aisha-government-id.pdf',
            'file_path' => 'uploads/aisha-government-id.pdf',
            'mime_type' => 'application/pdf',
            'file_size' => 150000,
            'issued_at' => '2025-01-01',
            'expires_at' => '2028-01-01',
        ])
            ->assertCreated()
            ->assertJsonPath('document.status', 'submitted')
            ->assertJsonPath('document.approval_requests.0.status', 'pending')
            ->json('document.id');

        $approval = ApprovalRequest::query()
            ->where('approvable_id', $documentId)
            ->where('module', 'employee_documents')
            ->firstOrFail();

        Sanctum::actingAs($admin);

        $this->postJson("/api/approvals/{$approval->id}/actions", [
            'action' => 'approve',
            'note' => 'Verified against original.',
        ])
            ->assertOk()
            ->assertJsonPath('approval_request.status', 'approved')
            ->assertJsonPath('approval_request.decisions.0.action', 'approve');

        $this->assertDatabaseHas('employee_documents', [
            'id' => $documentId,
            'status' => 'approved',
        ]);
    }

    public function test_request_changes_requires_note_when_workflow_policy_requires_it(): void
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

        $approval = ApprovalRequest::query()->where('approvable_id', $documentId)->firstOrFail();

        $this->postJson("/api/approvals/{$approval->id}/actions", [
            'action' => 'request_changes',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['note']);
    }

    public function test_default_document_workflow_is_seeded(): void
    {
        $this->seed();

        $workflow = ApprovalWorkflow::query()
            ->where('module', 'employee_documents')
            ->where('action', 'submit')
            ->with('steps')
            ->firstOrFail();

        $this->assertTrue($workflow->is_active);
        $this->assertSame('permission', $workflow->steps->first()->approver_type);
        $this->assertSame('employee_documents.update', $workflow->steps->first()->approver_permission);
    }
}
