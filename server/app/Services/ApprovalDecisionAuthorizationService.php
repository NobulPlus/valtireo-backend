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
