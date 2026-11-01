<?php

namespace App\Services;

use App\Models\ApprovalRequest;
use App\Models\ApprovalWorkflowStep;
use App\Models\Employee;
use App\Models\PayrollRun;
use App\Models\User;

/** Identity restrictions are independent of role and workflow authority. */
final class ApprovalDecisionAuthorizationService
{
    public const ACTIONS = ['approve', 'reject', 'request_changes', 'cancel'];

    /**
     * Each approvable module's pre-decision status — the only state a
     * cancellation may legitimately act on. PayrollRun's is
     * 'pending_approval' (PayrollService::submit()); every other module
     * defaults to, and is explicitly set to, 'submitted' when it enters an
     * approval workflow (confirmed against each module's own migration
     * default and, for tickets specifically, TicketService's explicit
     * non-direct-routed status). An ApprovalRequest can be left 'pending'
     * while its source has already moved past this state — e.g. a stale
     * duplicate, or the source advancing through some other path — and
     * cancelling it in that condition would drag an already-decided record
     * backwards (a finalized payroll run back to 'calculated', an approved
     * document back to 'submitted', and so on). This is a data-consistency
     * precondition, not a privilege: it applies identically regardless of
     * who is attempting the cancellation.
     */
    private const CANCELLABLE_SOURCE_STATUSES = [
        PayrollRun::class => ['pending_approval'],
    ];

    private const DEFAULT_CANCELLABLE_SOURCE_STATUS = 'submitted';

    public function restriction(User $actor, ApprovalRequest $request, string $action): ?string
    {
        $request->loadMissing(['workflow.steps.approverRole', 'subjectEmployee.department', 'approvable']);
        if ($request->organization_id !== $actor->organization_id
            || ($request->workflow && $request->workflow->organization_id !== $actor->organization_id)
            || ($request->subjectEmployee && $request->subjectEmployee->organization_id !== $actor->organization_id)
            || ! $request->approvable || $request->approvable->organization_id !== $actor->organization_id) {
            return 'tenant_mismatch';
        }
        if (! in_array($action, self::ACTIONS, true)) {
            return 'invalid_action';
        }
        if ($request->status !== 'pending') {
            return 'not_pending';
        }
        if ($action === 'cancel' && ! $this->isCancellableSourceState($request)) {
            return 'source_not_pending';
        }
        if ($action === 'approve') {
            $sourceEmployeeId = $request->approvable->getAttribute('employee_id');
            $sourceEmployee = $sourceEmployeeId ? Employee::find($sourceEmployeeId) : null;
            if ($sourceEmployeeId && (! $sourceEmployee || $sourceEmployee->organization_id !== $actor->organization_id)) {
                return 'tenant_mismatch';
            }
            if (! $request->requester_id) {
                return 'submission_owner_unknown';
            }
            if ($request->requester_id === $actor->id
                || ($request->subjectEmployee && $request->subjectEmployee->user_id === $actor->id)
                || $sourceEmployee?->user_id === $actor->id
                || $request->approvable->getAttribute('requested_by_id') === $actor->id
                || $request->approvable->getAttribute('uploaded_by_id') === $actor->id) {
                return 'self_approval_not_allowed';
            }
            if ($request->approvable instanceof PayrollRun) {
                $history = ApprovalRequest::query()->where('organization_id', $actor->organization_id)
                    ->where('approvable_type', $request->approvable_type)->where('approvable_id', $request->approvable_id);
                if ((clone $history)->where('requester_id', $actor->id)->exists()) {
                    return 'payroll_submitter_cannot_approve';
                }
                if ((clone $history)->whereNull('requester_id')->exists()) {
                    return 'submission_owner_unknown';
                }
                if (! $actor->can('payroll.runs.approve')) {
                    return 'payroll_approval_permission_required';
                }
                if ($request->approvable->status !== 'pending_approval') {
                    return 'source_not_pending';
                }
            } elseif ($request->approvable->status === 'cancelled') {
                return 'source_not_pending';
            }
        }
        if ($action === 'cancel' && ($request->requester_id === $actor->id
            || $request->subjectEmployee?->user_id === $actor->id)) {
            return null;
        }
        if ($actor->is_platform_admin || $actor->can('organizations.administer')) {
            return null;
        }
        $step = $this->currentStep($request);
        if (! $step) {
            return 'approval_step_unavailable';
        }
        $subject = $request->subjectEmployee;
        $allowed = match ($step->approver_type) {
            'permission' => $step->approver_permission && $actor->can($step->approver_permission),
            'role' => $step->approverRole && $step->approverRole->organization_id === $actor->organization_id && $actor->hasRole($step->approverRole),
            'direct_manager' => $subject && $actor->employee?->organization_id === $actor->organization_id && $actor->employee?->id === $subject->reporting_manager_id,
            'department_head' => $subject && $subject->department?->organization_id === $actor->organization_id && $actor->employee?->organization_id === $actor->organization_id && $actor->employee?->id === $subject->department?->head_employee_id,
            default => false,
        };
        return $allowed ? null : 'not_current_approver';
    }

    private function isCancellableSourceState(ApprovalRequest $request): bool
    {
        $approvable = $request->approvable;

        if (! $approvable) {
            return false;
        }

        $validStatuses = self::CANCELLABLE_SOURCE_STATUSES[$approvable::class] ?? [self::DEFAULT_CANCELLABLE_SOURCE_STATUS];

        return in_array($approvable->status, $validStatuses, true);
    }

    public function currentStep(ApprovalRequest $request): ?ApprovalWorkflowStep
    {
        return $request->workflow?->steps->where('is_active', true)
            ->where('step_order', $request->current_step_order)->first();
    }

    public function capabilities(User $actor, ApprovalRequest $request): array
    {
        $allowed = [];
        $restrictions = [];
        foreach (self::ACTIONS as $action) {
            $reason = $this->restriction($actor, $request, $action);
            if ($reason === null) {
                $allowed[] = $action;
            } else {
                $restrictions[$action] = $reason;
            }
        }
        return ['allowed_actions' => $allowed, 'action_restrictions' => $restrictions];
    }
}
