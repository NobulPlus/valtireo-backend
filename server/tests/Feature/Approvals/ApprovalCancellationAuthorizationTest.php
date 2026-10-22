<?php

namespace Tests\Feature\Approvals;

use App\Models\{ApprovalRequest, ApprovalWorkflow, AttendanceCorrectionRequest, AttendanceRecord, DocumentType, Employee, EmployeeDocument, LeaveRequest, LeaveType, PayrollRun, Ticket, TicketCategory, User};
use App\Services\ApprovalDecisionAuthorizationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Review-only regression coverage; production authorization is unchanged. */
class ApprovalCancellationAuthorizationTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private User $employee;
    private int $sequence = 0;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
        $this->admin = User::where('email', 'admin@valtireo.test')->firstOrFail();
        $this->employee = User::where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        $this->actingAsInOrganization($this->employee);
    }

    private function requestFor(string $kind, User $requester, Employee $subject): ApprovalRequest
    {
        $sequence = ++$this->sequence;
        $common = ['organization_id' => $subject->organization_id, 'employee_id' => $subject->id, 'status' => 'submitted'];
        $source = match ($kind) {
            'employee_documents' => EmployeeDocument::create([...$common, 'uploaded_by_id' => $requester->id,
                'document_type_id' => DocumentType::where('organization_id', $subject->organization_id)->firstOrFail()->id,
                'title' => 'Cancellation review', 'file_name' => 'test.pdf', 'file_path' => 'test.pdf']),
            'leave' => LeaveRequest::create([...$common, 'requested_by_id' => $requester->id,
                'leave_type_id' => LeaveType::where('organization_id', $subject->organization_id)->firstOrFail()->id,
                'starts_on' => now()->addDays(10), 'ends_on' => now()->addDays(11), 'total_days' => 2]),
            'payroll' => PayrollRun::create(['organization_id' => $subject->organization_id, 'reference' => 'CANCEL-'.$sequence,
                'name' => 'Cancellation review', 'period_start' => '2026-01-01', 'period_end' => '2026-01-31',
                'payment_date' => '2026-01-31', 'currency' => 'NGN', 'status' => 'pending_approval']),
            'service_desk' => Ticket::create([...$common, 'requested_by_id' => $requester->id,
                'ticket_category_id' => TicketCategory::where('organization_id', $subject->organization_id)->firstOrFail()->id,
                'subject' => 'Cancellation review', 'description' => 'Test']),
            'attendance' => AttendanceCorrectionRequest::create([...$common, 'requested_by_id' => $requester->id, 'reason' => 'Test',
                'attendance_record_id' => AttendanceRecord::create(['organization_id' => $subject->organization_id,
                    'employee_id' => $subject->id, 'attendance_date' => now()->addDays(100 + $sequence),
                    'duration_minutes' => 480, 'status' => 'present'])->id]),
        };
        $workflow = ApprovalWorkflow::create(['organization_id' => $subject->organization_id, 'module' => $kind,
            'action' => 'review-'.$sequence, 'name' => 'Cancellation review', 'is_active' => true]);
        $workflow->steps()->create(['step_order' => 1, 'name' => 'Administrator review', 'approver_type' => 'permission',
            'approver_permission' => 'organizations.administer', 'is_active' => true, 'note_required' => false]);
        return ApprovalRequest::create(['organization_id' => $subject->organization_id, 'approval_workflow_id' => $workflow->id,
            'requester_id' => $requester->id, 'subject_employee_id' => $kind === 'payroll' ? null : $subject->id,
            'approvable_type' => $source::class, 'approvable_id' => $source->id, 'module' => $kind, 'action' => 'review-'.$sequence,
            'title' => 'Cancellation review', 'status' => 'pending', 'current_step_order' => 1]);
    }

    public function test_requester_and_personal_subject_cancellation_preserve_each_source_effect(): void
    {
        $otherSubject = User::where('email', 'kelechi.nwosu@valtireo.test')->firstOrFail()->employee;
        foreach (['leave', 'payroll', 'employee_documents', 'service_desk', 'attendance'] as $kind) {
            foreach (['requester', 'subject'] as $identity) {
                if ($kind === 'payroll' && $identity === 'subject') continue;
                $request = $this->requestFor($kind, $identity === 'requester' ? $this->employee : $this->admin,
                    $identity === 'requester' ? $otherSubject : $this->employee->employee);
                $capabilities = app(ApprovalDecisionAuthorizationService::class)->capabilities($this->employee, $request);
                $this->assertContains('cancel', $capabilities['allowed_actions']);
                $this->postJson("/api/approvals/{$request->id}/actions", ['action' => 'cancel'])->assertOk();
                $expected = match ($kind) { 'payroll' => 'calculated', 'employee_documents' => 'submitted', default => 'cancelled' };
                $this->assertSame($expected, $request->approvable()->firstOrFail()->status);
                $this->assertSame($this->employee->id, $request->decisions()->firstOrFail()->actor_id);
                if ($kind === 'attendance') {
                    $this->assertSame(480, $request->approvable()->firstOrFail()->attendanceRecord->duration_minutes);
                }
                $this->postJson("/api/approvals/{$request->id}/actions", ['action' => 'cancel'])->assertUnprocessable();
                $this->assertSame(1, $request->decisions()->count());
            }
        }
    }

    public function test_unrelated_and_cross_tenant_users_cannot_cancel_any_module(): void
    {
        $unrelated = User::where('email', 'daniel.adeyemi@valtireo.test')->firstOrFail();
        $foreign = User::where('organization_id', '!=', $this->admin->organization_id)->firstOrFail();
        foreach (['leave', 'payroll', 'employee_documents', 'service_desk', 'attendance'] as $kind) {
            $request = $this->requestFor($kind, $this->employee, $this->employee->employee);
            $this->actingAsInOrganization($unrelated);
            $this->assertNotContains('cancel', app(ApprovalDecisionAuthorizationService::class)->capabilities($unrelated, $request)['allowed_actions']);
            $this->postJson("/api/approvals/{$request->id}/actions", ['action' => 'cancel'])->assertForbidden();
            $this->actingAsInOrganization($foreign);
            $this->postJson("/api/approvals/{$request->id}/actions", ['action' => 'cancel'])->assertNotFound();
            $this->assertSame(0, $request->decisions()->count());
        }
    }

    public function test_pending_cancellation_retains_step_note_requirement(): void
    {
        $request = $this->requestFor('employee_documents', $this->employee, $this->employee->employee);
        $request->workflow->steps()->update(['note_required' => true]);
        $this->postJson("/api/approvals/{$request->id}/actions", ['action' => 'cancel'])->assertUnprocessable()->assertJsonValidationErrors('note');
        $this->assertSame(0, $request->decisions()->count());
        $this->postJson("/api/approvals/{$request->id}/actions", ['action' => 'cancel', 'note' => 'Withdrawing submission'])->assertOk();
    }

    public function test_administrative_recovery_capability_still_requires_a_note_at_execution(): void
    {
        $request = $this->requestFor('employee_documents', $this->employee, $this->employee->employee);
        $request->workflow->steps()->update(['is_active' => false]);
        $this->actingAsInOrganization($this->admin);
        $this->getJson("/api/approvals/{$request->id}")->assertOk()
            ->assertJsonFragment(['allowed_actions' => ['approve', 'reject', 'request_changes', 'cancel']]);
        $this->postJson("/api/approvals/{$request->id}/actions", ['action' => 'approve'])->assertUnprocessable()->assertJsonValidationErrors('note');
        $this->assertSame(0, $request->decisions()->count());
        $this->postJson("/api/approvals/{$request->id}/actions", ['action' => 'approve', 'note' => 'Recovery reviewed'])->assertOk();
        $this->assertTrue($request->decisions()->firstOrFail()->metadata['administrative_recovery']);
    }
}
