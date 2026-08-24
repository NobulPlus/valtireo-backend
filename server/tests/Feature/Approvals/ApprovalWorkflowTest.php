<?php

namespace Tests\Feature\Approvals;

use App\Models\ApprovalRequest;
use App\Models\ApprovalWorkflow;
use App\Models\DocumentRequirement;
use App\Models\DocumentType;
use App\Models\Employee;
use App\Models\Role;
use App\Models\User;
use Illuminate\Contracts\Notifications\Dispatcher;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ApprovalWorkflowTest extends TestCase
{
    use RefreshDatabase;

    public function test_organization_admin_can_configure_approval_workflow_steps(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $departmentHeadRole = Role::query()
            ->where('organization_id', $admin->organization_id)
            ->where('name', 'Department Head')
            ->firstOrFail();

        Sanctum::actingAs($admin);

        $workflowId = $this->postJson('/api/approval-workflows', [
            'module' => 'leave',
            'action' => 'submit',
            'name' => 'Leave request approval',
            'description' => 'Department head, then a named role, then HR approval for leave.',
            'require_note_on_reject' => true,
            'steps' => [
                [
                    'step_order' => 1,
                    'name' => 'Department head approval',
                    'approver_type' => 'department_head',
                    'note_required' => false,
                ],
                [
                    'step_order' => 2,
                    'name' => 'Department Head role sign-off',
                    'approver_type' => 'role',
                    'approver_role_id' => $departmentHeadRole->id,
                    'note_required' => false,
                ],
                [
                    'step_order' => 3,
                    'name' => 'HR approval',
                    'approver_type' => 'permission',
                    'approver_permission' => 'leave_requests.approve',
                    'note_required' => true,
                ],
            ],
        ])
            ->assertCreated()
            ->assertJsonPath('approval_workflow.module', 'leave')
            ->assertJsonPath('approval_workflow.steps.0.approver_type', 'department_head')
            ->assertJsonPath('approval_workflow.steps.1.approver_role_id', $departmentHeadRole->id)
            ->assertJsonPath('approval_workflow.steps.1.approver_role.name', 'Department Head')
            ->assertJsonPath('approval_workflow.steps.2.approver_permission', 'leave_requests.approve')
            ->json('approval_workflow.id');

        $this->getJson("/api/approval-workflows/{$workflowId}")
            ->assertOk()
            ->assertJsonPath('data.steps.1.approver_role_id', $departmentHeadRole->id)
            ->assertJsonPath('data.steps.2.name', 'HR approval');
    }

    public function test_role_based_approver_step_rejects_an_unknown_role_id(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        Sanctum::actingAs($admin);

        $this->postJson('/api/approval-workflows', [
            'module' => 'leave',
            'action' => 'submit',
            'name' => 'Broken role step',
            'steps' => [
                [
                    'step_order' => 1,
                    'name' => 'Unknown role',
                    'approver_type' => 'role',
                    'approver_role_id' => 999999,
                ],
            ],
        ])->assertUnprocessable()->assertJsonValidationErrors(['steps.0.approver_role_id']);
    }

    public function test_document_submission_creates_approval_request_and_review_decision(): void
    {
        Storage::fake('local');
        $this->seed();

        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $type = DocumentType::query()->where('organization_id', $employeeUser->organization_id)->where('code', 'GOV-ID')->firstOrFail();
        $requirement = DocumentRequirement::query()
            ->where('organization_id', $employeeUser->organization_id)
            ->where('document_type_id', $type->id)
            ->firstOrFail();

        Sanctum::actingAs($employeeUser);

        $documentId = $this->post('/api/documents', [
            'document_type_id' => $type->id,
            'document_requirement_id' => $requirement->id,
            'title' => 'Aisha Government ID',
            'file' => UploadedFile::fake()->create('aisha-government-id.pdf', 128, 'application/pdf'),
            'issued_at' => '2025-01-01',
            'expires_at' => '2028-01-01',
        ], ['Accept' => 'application/json'])
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

    public function test_decision_is_recorded_even_when_notification_delivery_fails(): void
    {
        Storage::fake('local');
        $this->seed();

        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $type = DocumentType::query()->where('organization_id', $employeeUser->organization_id)->where('code', 'GOV-ID')->firstOrFail();
        $requirement = DocumentRequirement::query()
            ->where('organization_id', $employeeUser->organization_id)
            ->where('document_type_id', $type->id)
            ->firstOrFail();

        Sanctum::actingAs($employeeUser);

        $documentId = $this->post('/api/documents', [
            'document_type_id' => $type->id,
            'document_requirement_id' => $requirement->id,
            'title' => 'Aisha Government ID',
            'file' => UploadedFile::fake()->create('aisha-government-id.pdf', 128, 'application/pdf'),
            'issued_at' => '2025-01-01',
            'expires_at' => '2028-01-01',
        ], ['Accept' => 'application/json'])
            ->assertCreated()
            ->json('document.id');

        $approval = ApprovalRequest::query()
            ->where('approvable_id', $documentId)
            ->where('module', 'employee_documents')
            ->firstOrFail();

        $this->mock(Dispatcher::class, function ($mock) {
            $mock->shouldReceive('send')->andThrow(new \RuntimeException(
                'Failed to authenticate on SMTP server with username "b5a4a5001@smtp-brevo.com"'
            ));
        });

        Sanctum::actingAs($admin);

        $this->postJson("/api/approvals/{$approval->id}/actions", [
            'action' => 'approve',
            'note' => 'Verified against original.',
        ])
            ->assertOk()
            ->assertJsonPath('approval_request.status', 'approved');

        $this->assertDatabaseHas('employee_documents', [
            'id' => $documentId,
            'status' => 'approved',
        ]);
        $this->assertDatabaseHas('approval_requests', [
            'id' => $approval->id,
            'status' => 'approved',
        ]);
    }

    public function test_unrelated_employee_cannot_cancel_someone_elses_pending_approval(): void
    {
        Storage::fake('local');
        $this->seed();

        $requester = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        $unrelatedEmployee = User::query()->where('email', 'daniel.adeyemi@valtireo.test')->firstOrFail();
        $type = DocumentType::query()->where('organization_id', $requester->organization_id)->where('code', 'GOV-ID')->firstOrFail();
        $requirement = DocumentRequirement::query()
            ->where('organization_id', $requester->organization_id)
            ->where('document_type_id', $type->id)
            ->firstOrFail();

        Sanctum::actingAs($requester);

        $documentId = $this->post('/api/documents', [
            'document_type_id' => $type->id,
            'document_requirement_id' => $requirement->id,
            'title' => 'Aisha Government ID',
            'file' => UploadedFile::fake()->create('aisha-government-id.pdf', 128, 'application/pdf'),
            'issued_at' => '2025-01-01',
            'expires_at' => '2028-01-01',
        ], ['Accept' => 'application/json'])
            ->assertCreated()
            ->json('document.id');

        $approval = ApprovalRequest::query()
            ->where('approvable_id', $documentId)
            ->where('module', 'employee_documents')
            ->firstOrFail();

        Sanctum::actingAs($unrelatedEmployee);

        $this->postJson("/api/approvals/{$approval->id}/actions", [
            'action' => 'cancel',
        ])->assertForbidden();

        $this->assertDatabaseHas('approval_requests', [
            'id' => $approval->id,
            'status' => 'pending',
        ]);

        Sanctum::actingAs($requester);

        $this->postJson("/api/approvals/{$approval->id}/actions", [
            'action' => 'cancel',
        ])
            ->assertOk()
            ->assertJsonPath('approval_request.status', 'cancelled');
    }

    public function test_request_changes_requires_note_when_workflow_policy_requires_it(): void
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
