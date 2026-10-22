<?php

namespace Tests\Feature\Approvals;

use App\Models\{ApprovalRequest, ApprovalWorkflow, DocumentType, EmployeeDocument, LeaveRequest, LeaveType, PayrollRun, Role, User};
use App\Services\{ApprovalRequestService, DefaultRoleSeedingService, PayrollService};
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class ApprovalSeparationOfDutiesTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private User $employee;
    private User $hr;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
        $this->admin = User::where('email', 'admin@valtireo.test')->firstOrFail();
        $this->employee = User::where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        $this->hr = User::where('email', 'mariam.okafor@valtireo.test')->firstOrFail();
        $this->actingAsInOrganization($this->admin);
    }

    private function document(?User $owner = null): EmployeeDocument
    {
        return EmployeeDocument::create([
            'organization_id' => $this->admin->organization_id, 'employee_id' => $this->employee->employee->id,
            'document_type_id' => DocumentType::where('organization_id', $this->admin->organization_id)->firstOrFail()->id,
            'uploaded_by_id' => ($owner ?? $this->employee)->id,
            'title' => 'Ownership test', 'file_name' => 'test.pdf', 'file_path' => 'test.pdf', 'status' => 'submitted',
        ]);
    }

    private function submitDocument(?User $owner = null): ApprovalRequest
    {
        $owner ??= $this->employee;
        $document = $this->document($owner);
        return app(ApprovalRequestService::class)->submit($owner, $document, 'employee_documents', 'submit', 'Review document', $document->employee);
    }

    private function decide(ApprovalRequest $request, string $action = 'approve', ?string $note = 'Reviewed')
    {
        return $this->postJson("/api/approvals/{$request->id}/actions", compact('action', 'note'));
    }

    private function payrollRun(): PayrollRun
    {
        return PayrollRun::create([
            'organization_id' => $this->admin->organization_id, 'reference' => 'SOD-'.uniqid(), 'name' => 'Test run',
            'period_start' => '2026-01-01', 'period_end' => '2026-01-31', 'payment_date' => '2026-01-31',
            'currency' => 'NGN', 'status' => 'calculated', 'created_by_id' => $this->admin->id,
        ]);
    }

    private function submitPayroll(User $actor, PayrollRun $run): ApprovalRequest
    {
        app(PayrollService::class)->submit($actor, $run);
        return ApprovalRequest::where('approvable_type', PayrollRun::class)->where('approvable_id', $run->id)->latest('id')->firstOrFail();
    }

    public function test_admin_and_platform_admin_cannot_approve_their_own_submission(): void
    {
        $request = $this->submitDocument($this->admin);
        $this->decide($request)->assertForbidden();
        $this->admin->update(['is_platform_admin' => true]);
        $this->decide($request)->assertForbidden();
        $this->assertSame(0, $request->decisions()->count());
        $this->assertSame('pending', $request->fresh()->status);
    }

    public function test_subject_cannot_approve_on_behalf_submission_even_with_admin_role(): void
    {
        $request = $this->submitDocument($this->admin);
        $this->employee->assignRole($this->admin->roles->first());
        $this->actingAsInOrganization($this->employee);
        $this->decide($request)->assertForbidden();
        $this->getJson("/api/approvals/{$request->id}")->assertOk()
            ->assertJsonPath('data.action_restrictions.approve', 'self_approval_not_allowed');
        $this->decide($request, 'cancel')->assertOk();
    }

    public function test_hr_approves_another_submitters_payroll_with_actual_actor_audit(): void
    {
        $run = $this->payrollRun();
        $request = $this->submitPayroll($this->admin, $run);
        $this->actingAsInOrganization($this->hr);
        $this->getJson("/api/payroll/runs/{$run->id}")->assertOk();
        $this->decide($request)->assertOk()->assertJsonPath('approval_request.status', 'approved');
        $this->assertDatabaseHas('approval_decisions', ['approval_request_id' => $request->id, 'actor_id' => $this->hr->id, 'action' => 'approve']);
        $this->assertSame('approved', $run->fresh()->status);
        $this->postJson("/api/payroll/runs/{$run->id}/finalize")->assertForbidden();
    }

    public function test_combined_roles_and_resubmission_do_not_erase_payroll_submitter(): void
    {
        $this->hr->assignRole(Role::where('organization_id', $this->hr->organization_id)->where('key', 'payroll_admin')->firstOrFail());
        $run = $this->payrollRun();
        $request = $this->submitPayroll($this->hr->fresh(), $run);
        $this->actingAsInOrganization($this->hr);
        $this->decide($request)->assertForbidden();
        $this->decide($request, 'cancel')->assertOk();
        $request = $this->submitPayroll($this->admin, $run->fresh());
        $this->decide($request)->assertForbidden();
        $this->actingAsInOrganization($this->admin);
        $this->decide($request)->assertForbidden();
    }

    public function test_payroll_permission_is_required_even_for_custom_role_step_and_after_revocation(): void
    {
        $run = $this->payrollRun();
        $request = $this->submitPayroll($this->admin, $run);
        $payrollRole = Role::where('organization_id', $this->admin->organization_id)->where('key', 'payroll_admin')->firstOrFail();
        $this->employee->syncRoles([$payrollRole]);
        $request->workflow->steps()->update(['approver_type' => 'role', 'approver_role_id' => $payrollRole->id]);
        $this->actingAsInOrganization($this->employee);
        $this->decide($request)->assertForbidden();
        $this->hr->roles->first()->revokePermissionTo('payroll.runs.approve');
        $this->actingAsInOrganization($this->hr);
        $this->decide($request)->assertForbidden();
    }

    public function test_cross_tenant_approval_and_source_mismatch_fail_without_decisions(): void
    {
        $request = $this->submitDocument();
        $other = User::where('organization_id', '!=', $this->admin->organization_id)->firstOrFail();
        $this->actingAsInOrganization($other);
        $this->decide($request)->assertNotFound();
        $this->actingAsInOrganization($this->admin);
        $request->approvable->update(['organization_id' => $other->organization_id]);
        $this->decide($request)->assertNotFound();
        $this->assertSame(0, $request->decisions()->count());
    }

    public function test_document_fallback_uses_uploader_and_never_reopens_completed_request(): void
    {
        $document = $this->document();
        $this->patchJson("/api/documents/{$document->id}/review", ['action' => 'approve'])->assertOk();
        $request = $document->approvalRequests()->firstOrFail();
        $this->assertSame($this->employee->id, $request->requester_id);
        $this->assertSame($this->admin->id, $request->decisions()->firstOrFail()->actor_id);
        $this->patchJson("/api/documents/{$document->id}/review", ['action' => 'approve'])->assertUnprocessable();
        $this->assertSame(1, $document->approvalRequests()->count());
        $unknown = $this->document();
        $unknown->update(['uploaded_by_id' => null]);
        $this->patchJson("/api/documents/{$unknown->id}/review", ['action' => 'approve'])->assertUnprocessable();
    }

    public function test_pending_document_is_reused_and_self_upload_cannot_be_reviewed(): void
    {
        $request = $this->submitDocument();
        $this->patchJson("/api/documents/{$request->approvable_id}/review", ['action' => 'approve'])->assertOk();
        $this->assertSame(1, $request->approvable->approvalRequests()->count());
        $own = $this->document($this->admin);
        $this->patchJson("/api/documents/{$own->id}/review", ['action' => 'approve'])->assertForbidden();
        $this->assertSame('submitted', $own->fresh()->status);
    }

    public function test_automatic_document_approval_has_system_not_human_actor(): void
    {
        $workflow = ApprovalWorkflow::where('organization_id', $this->admin->organization_id)->where('module', 'employee_documents')->firstOrFail();
        $workflow->steps()->delete();
        $workflow->update(['auto_approve_when_no_steps' => true]);
        $request = $this->submitDocument();
        $this->assertSame('approved', $request->status);
        $this->assertNull($request->decisions()->firstOrFail()->actor_id);
        $this->assertSame('system', $request->decisions()->firstOrFail()->metadata['origin']);
        $this->assertNull($request->approvable->reviewed_by_id);
    }

    public function test_automatic_or_empty_payroll_workflow_is_rejected_without_submitting_run(): void
    {
        $workflow = ApprovalWorkflow::where('organization_id', $this->admin->organization_id)->where('module', 'payroll')->firstOrFail();
        $workflow->update(['auto_approve_when_no_steps' => true]);
        $run = $this->payrollRun();
        $this->postJson("/api/payroll/runs/{$run->id}/submit")->assertUnprocessable();
        $workflow->steps()->delete();
        $workflow->update(['auto_approve_when_no_steps' => false]);
        $this->postJson("/api/payroll/runs/{$run->id}/submit")->assertUnprocessable();
        $this->assertSame('calculated', $run->fresh()->status);
    }

    public function test_recovery_requires_another_actor_and_note_and_records_recovery(): void
    {
        $request = $this->submitDocument();
        $request->workflow->steps()->update(['is_active' => false]);
        $this->decide($request, 'approve', null)->assertUnprocessable();
        $this->decide($request)->assertOk();
        $this->assertTrue($request->decisions()->firstOrFail()->metadata['administrative_recovery']);
    }

    public function test_rejection_and_changes_remain_authorized_for_requester_admin(): void
    {
        foreach (['reject', 'request_changes', 'cancel'] as $action) {
            $request = $this->submitDocument($this->admin);
            $this->decide($request, $action)->assertOk();
        }
    }

    public function test_unknown_action_and_stale_repeated_decision_cannot_mutate(): void
    {
        $request = $this->submitDocument();
        try {
            app(ApprovalRequestService::class)->act($this->admin, $request, 'unexpected');
            $this->fail('Unknown action was accepted.');
        } catch (ValidationException) {
            $this->assertSame(0, $request->decisions()->count());
        }
        $stale = $request->fresh();
        $this->decide($request)->assertOk();
        try {
            app(ApprovalRequestService::class)->act($this->admin, $stale, 'approve');
            $this->fail('Stale decision was accepted.');
        } catch (ValidationException) {
            $this->assertSame(1, $request->decisions()->count());
        }
    }

    public function test_default_provisioning_does_not_backfill_existing_hr_grants(): void
    {
        $this->assertTrue($this->hr->can('payroll.runs.approve'));
        $role = $this->hr->roles->first();
        $role->revokePermissionTo('payroll.runs.approve');
        app(DefaultRoleSeedingService::class)->seedForOrganization($this->hr->organization);
        $this->assertFalse($role->fresh()->hasPermissionTo('payroll.runs.approve'));
    }

    public function test_stale_step_cannot_advance_the_next_step_or_duplicate_audit(): void
    {
        $request = $this->submitDocument();
        $request->workflow->steps()->create([
            'step_order' => 2, 'name' => 'Second review', 'approver_type' => 'permission',
            'approver_permission' => 'employee_documents.update', 'is_active' => true,
        ]);
        $this->decide($request)->assertOk()->assertJsonPath('approval_request.current_step_order', 2);
        $this->postJson("/api/approvals/{$request->id}/actions", ['action' => 'approve', 'expected_step_order' => 1])->assertUnprocessable();
        $this->assertSame(1, $request->decisions()->count());
        $this->decide($request->fresh())->assertOk();
        $this->assertSame(2, $request->decisions()->count());
        $this->assertSame(1, $request->approvable->reviews()->count());
    }

    public function test_missing_subject_pointer_does_not_allow_personal_source_owner_to_approve(): void
    {
        $request = $this->submitDocument($this->admin);
        $request->update(['subject_employee_id' => null]);
        $this->employee->assignRole($this->admin->roles->first());
        $this->actingAsInOrganization($this->employee);
        $this->decide($request)->assertForbidden();
    }

    public function test_unknown_requester_cannot_be_treated_as_system_approval(): void
    {
        $request = $this->submitDocument();
        $request->update(['requester_id' => null]);
        $this->decide($request)->assertForbidden();
        $this->decide($request, 'cancel')->assertOk();
    }

    public function test_payroll_workflow_configuration_cannot_enable_auto_approval_or_remove_all_steps(): void
    {
        $workflow = ApprovalWorkflow::where('organization_id', $this->admin->organization_id)->where('module', 'payroll')->firstOrFail();
        $this->patchJson("/api/approval-workflows/{$workflow->id}", ['auto_approve_when_no_steps' => true])->assertUnprocessable();
        $this->patchJson("/api/approval-workflows/{$workflow->id}", ['steps' => []])->assertUnprocessable();
        $this->assertFalse($workflow->fresh()->auto_approve_when_no_steps);
        $this->assertTrue($workflow->steps()->exists());
    }

    public function test_domain_leave_cancellation_prevents_later_approval_and_repeated_cancellation(): void
    {
        $employee = $this->employee->employee;
        $leave = LeaveRequest::create([
            'organization_id' => $employee->organization_id, 'employee_id' => $employee->id,
            'leave_type_id' => LeaveType::where('organization_id', $employee->organization_id)->firstOrFail()->id,
            'requested_by_id' => $this->employee->id, 'starts_on' => now()->addDays(10), 'ends_on' => now()->addDays(11),
            'total_days' => 2, 'status' => 'submitted',
        ]);
        $request = app(ApprovalRequestService::class)->submit($this->employee, $leave, 'leave', 'submit', 'Leave', $employee);
        $this->actingAsInOrganization($this->employee);
        $this->patchJson("/api/leave/requests/{$leave->id}/cancel")->assertOk();
        $this->patchJson("/api/leave/requests/{$leave->id}/cancel")->assertUnprocessable();
        $this->actingAsInOrganization($this->admin);
        $this->decide($request)->assertUnprocessable();
        $this->assertSame('cancelled', $request->fresh()->status);
        $this->assertSame(1, $request->decisions()->count());
    }

    public function test_leave_requester_and_subject_are_denied_but_actual_manager_can_approve(): void
    {
        $manager = User::where('email', 'kelechi.nwosu@valtireo.test')->firstOrFail();
        $employee = $this->employee->employee;
        $employee->update(['reporting_manager_id' => $manager->employee->id]);
        $leave = LeaveRequest::create([
            'organization_id' => $employee->organization_id, 'employee_id' => $employee->id,
            'leave_type_id' => LeaveType::where('organization_id', $employee->organization_id)->firstOrFail()->id,
            'requested_by_id' => $this->employee->id, 'starts_on' => now()->addDays(10), 'ends_on' => now()->addDays(11),
            'total_days' => 2, 'status' => 'submitted',
        ]);
        $request = app(ApprovalRequestService::class)->submit($this->employee, $leave, 'leave', 'submit', 'Leave', $employee);
        $this->employee->assignRole($this->admin->roles->first());
        $this->actingAsInOrganization($this->employee);
        $this->decide($request)->assertForbidden();
        $this->actingAsInOrganization($manager);
        $this->decide($request)->assertOk()->assertJsonPath('approval_request.current_step_order', 2);
        $this->actingAsInOrganization($this->employee);
        $this->decide($request->fresh())->assertForbidden();
    }
}
