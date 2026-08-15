<?php

namespace App\Services;

use App\Models\ApprovalRequest;
use App\Models\ApprovalWorkflow;
use App\Models\ApprovalWorkflowStep;
use App\Models\AttendanceCorrectionRequest;
use App\Models\Employee;
use App\Models\EmployeeDocument;
use App\Models\LeaveEntitlement;
use App\Models\LeaveRequest;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ApprovalRequestService
{
    public function __construct(private readonly NotificationDispatchService $notifications)
    {
    }

    /**
     * @param array<string, mixed> $metadata
     */
    public function submit(
        User $actor,
        Model $approvable,
        string $module,
        string $action,
        string $title,
        ?Employee $subjectEmployee = null,
        array $metadata = []
    ): ApprovalRequest {
        return DB::transaction(function () use ($actor, $approvable, $module, $action, $title, $subjectEmployee, $metadata): ApprovalRequest {
            $workflow = ApprovalWorkflow::query()
                ->where('organization_id', $actor->organization_id)
                ->where('module', $module)
                ->where('action', $action)
                ->where('is_active', true)
                ->with('steps')
                ->first();
            $firstStep = $workflow?->steps->where('is_active', true)->sortBy('step_order')->first();
            $status = $firstStep ? 'pending' : (($workflow?->auto_approve_when_no_steps ?? false) ? 'approved' : 'pending');

            $approvalRequest = ApprovalRequest::query()->create([
                'organization_id' => $actor->organization_id,
                'approval_workflow_id' => $workflow?->id,
                'requester_id' => $actor->id,
                'subject_employee_id' => $subjectEmployee?->id,
                'approvable_type' => $approvable::class,
                'approvable_id' => $approvable->getKey(),
                'module' => $module,
                'action' => $action,
                'title' => $title,
                'status' => $status,
                'current_step_order' => $firstStep?->step_order,
                'submitted_at' => now(),
                'completed_at' => $status === 'approved' ? now() : null,
                'metadata' => $metadata,
            ]);

            if ($approvalRequest->status === 'pending') {
                $this->notifications->approvalSubmitted($approvalRequest);
            }

            return $approvalRequest;
        });
    }

    public function act(User $actor, ApprovalRequest $approvalRequest, string $action, ?string $note = null): ApprovalRequest
    {
        if ($approvalRequest->organization_id !== $actor->organization_id) {
            abort(404);
        }

        if (! in_array($approvalRequest->status, ['pending'], true)) {
            throw ValidationException::withMessages([
                'action' => ['This approval request is no longer pending.'],
            ]);
        }

        return DB::transaction(function () use ($actor, $approvalRequest, $action, $note): ApprovalRequest {
            $approvalRequest->loadMissing(['workflow.steps', 'subjectEmployee']);
            $step = $this->currentStep($approvalRequest);

            if ($action === 'cancel') {
                $this->ensureActorCanCancel($actor, $approvalRequest, $step);
            } else {
                $this->ensureActorCanApproveStep($actor, $approvalRequest, $step);
            }

            $this->ensureRequiredNote($approvalRequest, $step, $action, $note);

            $previousStatus = $approvalRequest->status;
            $nextStatus = $this->nextStatus($approvalRequest, $step, $action);
            $nextStep = $nextStatus === 'pending' ? $this->nextStep($approvalRequest, $step) : null;

            $approvalRequest->decisions()->create([
                'approval_workflow_step_id' => $step?->id,
                'actor_id' => $actor->id,
                'action' => $action,
                'previous_status' => $previousStatus,
                'next_status' => $nextStatus,
                'note' => $note,
                'metadata' => [
                    'step_order' => $step?->step_order,
                    'step_name' => $step?->name,
                ],
            ]);

            $approvalRequest->update([
                'status' => $nextStatus,
                'current_step_order' => $nextStep?->step_order,
                'completed_at' => $nextStatus === 'pending' ? null : now(),
            ]);

            $approvalRequest = $approvalRequest->refresh();
            $this->syncApprovableStatus($approvalRequest, $actor, $action, $note);
            $this->notifications->approvalDecided($approvalRequest->refresh(), $actor);

            return $approvalRequest->load(['workflow.steps', 'requester', 'subjectEmployee', 'decisions.actor']);
        });
    }

    private function currentStep(ApprovalRequest $approvalRequest): ?ApprovalWorkflowStep
    {
        return $approvalRequest->workflow?->steps
            ->where('is_active', true)
            ->where('step_order', $approvalRequest->current_step_order)
            ->first();
    }

    private function nextStep(ApprovalRequest $approvalRequest, ?ApprovalWorkflowStep $currentStep): ?ApprovalWorkflowStep
    {
        return $approvalRequest->workflow?->steps
            ->where('is_active', true)
            ->where('step_order', '>', $currentStep?->step_order ?? 0)
            ->sortBy('step_order')
            ->first();
    }

    private function nextStatus(ApprovalRequest $approvalRequest, ?ApprovalWorkflowStep $step, string $action): string
    {
        if ($action === 'reject') {
            return 'rejected';
        }

        if ($action === 'request_changes') {
            return 'changes_requested';
        }

        if ($action === 'cancel') {
            return 'cancelled';
        }

        return $this->nextStep($approvalRequest, $step) ? 'pending' : 'approved';
    }

    private function ensureActorCanApproveStep(User $actor, ApprovalRequest $approvalRequest, ?ApprovalWorkflowStep $step): void
    {
        if ($actor->hasAnyRole(['Super Admin', 'Organization Admin'])) {
            return;
        }

        if (! $step) {
            abort(403);
        }

        $subjectEmployee = $approvalRequest->subjectEmployee;
        $allowed = match ($step->approver_type) {
            'permission' => $step->approver_permission && $actor->can($step->approver_permission),
            'role' => $step->approver_role && $actor->hasRole($step->approver_role),
            'direct_manager' => $subjectEmployee && $actor->employee?->id === $subjectEmployee->reporting_manager_id,
            'department_head' => $subjectEmployee && $actor->hasRole('Department Head') && $actor->employee?->department_id === $subjectEmployee->department_id,
            default => false,
        };

        abort_unless($allowed, 403);
    }

    private function ensureActorCanCancel(User $actor, ApprovalRequest $approvalRequest, ?ApprovalWorkflowStep $step): void
    {
        if ($actor->id === $approvalRequest->requester_id) {
            return;
        }

        if ($approvalRequest->subject_employee_id && $actor->employee?->id === $approvalRequest->subject_employee_id) {
            return;
        }

        $this->ensureActorCanApproveStep($actor, $approvalRequest, $step);
    }

    private function ensureRequiredNote(ApprovalRequest $approvalRequest, ?ApprovalWorkflowStep $step, string $action, ?string $note): void
    {
        $requiresNote = ($step?->note_required ?? false)
            || ($action === 'reject' && ($approvalRequest->workflow?->require_note_on_reject ?? true))
            || ($action === 'request_changes' && ($approvalRequest->workflow?->require_note_on_request_changes ?? true));

        if ($requiresNote && blank($note)) {
            throw ValidationException::withMessages([
                'note' => ['A decision note is required for this action.'],
            ]);
        }
    }

    private function syncApprovableStatus(ApprovalRequest $approvalRequest, User $actor, string $action, ?string $note): void
    {
        $approvable = $approvalRequest->approvable;

        if ($approvable instanceof LeaveRequest) {
            $this->syncLeaveRequestStatus($approvalRequest, $approvable);

            return;
        }

        if ($approvable instanceof AttendanceCorrectionRequest) {
            $this->syncAttendanceCorrectionStatus($approvalRequest, $approvable);

            return;
        }

        if (! $approvable instanceof EmployeeDocument) {
            return;
        }

        if (! in_array($approvalRequest->status, ['approved', 'rejected', 'changes_requested', 'cancelled'], true)) {
            return;
        }

        $previousStatus = $approvable->status;
        $nextStatus = $approvalRequest->status === 'cancelled' ? 'submitted' : $approvalRequest->status;

        $approvable->update([
            'status' => $nextStatus,
            'reviewed_by_id' => $actor->id,
            'review_note' => $note,
            'reviewed_at' => now(),
        ]);

        $approvable->reviews()->create([
            'reviewed_by_id' => $actor->id,
            'action' => $action,
            'previous_status' => $previousStatus,
            'next_status' => $nextStatus,
            'note' => $note,
        ]);
    }

    private function syncLeaveRequestStatus(ApprovalRequest $approvalRequest, LeaveRequest $leaveRequest): void
    {
        if (! in_array($approvalRequest->status, ['approved', 'rejected', 'changes_requested', 'cancelled'], true)) {
            return;
        }

        $previousStatus = $leaveRequest->status;
        $nextStatus = $approvalRequest->status;

        if ($previousStatus === $nextStatus) {
            return;
        }

        $entitlement = LeaveEntitlement::query()
            ->where('employee_id', $leaveRequest->employee_id)
            ->where('leave_type_id', $leaveRequest->leave_type_id)
            ->where('leave_period_id', $leaveRequest->leave_period_id)
            ->lockForUpdate()
            ->first();

        if ($entitlement && $previousStatus === 'submitted') {
            $entitlement->decrement('days_pending', $leaveRequest->total_days);
        }

        if ($entitlement && $nextStatus === 'approved') {
            $entitlement->increment('days_used', $leaveRequest->total_days);
        }

        $leaveRequest->update([
            'status' => $nextStatus,
            'reviewed_at' => now(),
        ]);
    }

    private function syncAttendanceCorrectionStatus(ApprovalRequest $approvalRequest, AttendanceCorrectionRequest $correction): void
    {
        if (! in_array($approvalRequest->status, ['approved', 'rejected', 'changes_requested', 'cancelled'], true)) {
            return;
        }

        $previousStatus = $correction->status;
        $nextStatus = $approvalRequest->status;

        if ($previousStatus === $nextStatus) {
            return;
        }

        if ($nextStatus === 'approved') {
            $record = $correction->attendanceRecord;
            $checkIn = $correction->requested_check_in_at ?? $record->check_in_at;
            $checkOut = $correction->requested_check_out_at ?? $record->check_out_at;

            $record->update([
                'check_in_at' => $checkIn,
                'check_out_at' => $checkOut,
                'duration_minutes' => AttendanceService::durationMinutes($checkIn, $checkOut, $record->workShift),
                'status' => 'corrected',
            ]);
        }

        $correction->update([
            'status' => $nextStatus,
            'reviewed_at' => now(),
        ]);
    }
}
