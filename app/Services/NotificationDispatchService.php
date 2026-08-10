<?php

namespace App\Services;

use App\Models\ApprovalRequest;
use App\Models\ApprovalWorkflowStep;
use App\Models\EmployeeInvitation;
use App\Models\User;
use App\Notifications\ValtireoNotification;
use Illuminate\Support\Collection;

class NotificationDispatchService
{
    /**
     * @param array<string, mixed> $data
     */
    public function notify(User $user, array $data): void
    {
        $user->notify(new ValtireoNotification([
            'organization_id' => $user->organization_id,
            'category' => $data['category'] ?? 'general',
            'event' => $data['event'] ?? 'notification.created',
            'severity' => $data['severity'] ?? 'info',
            'title' => $data['title'],
            'message' => $data['message'],
            'action_label' => $data['action_label'] ?? null,
            'action_url' => $data['action_url'] ?? null,
            'entity_type' => $data['entity_type'] ?? null,
            'entity_id' => $data['entity_id'] ?? null,
            'metadata' => $data['metadata'] ?? [],
        ]));
    }

    public function employeeInvited(EmployeeInvitation $invitation, string $plainToken): void
    {
        $invitation->loadMissing(['employee.user', 'invitedBy']);
        $employee = $invitation->employee;

        if ($employee?->user) {
            $this->notify($employee->user, [
                'category' => 'employee_onboarding',
                'event' => 'employee.invited',
                'title' => 'Complete your Valtireo invitation',
                'message' => "You have been invited to join {$employee->organization?->name}.",
                'action_label' => 'Accept invitation',
                'action_url' => "/employee-invitations/{$plainToken}/accept",
                'entity_type' => 'employee_invitation',
                'entity_id' => $invitation->id,
                'metadata' => [
                    'employee_id' => $employee->id,
                    'expires_at' => $invitation->expires_at?->toDateTimeString(),
                    'token' => $plainToken,
                ],
            ]);
        }

        if ($invitation->invitedBy) {
            $this->notify($invitation->invitedBy, [
                'category' => 'employee_onboarding',
                'event' => 'employee.invitation_created',
                'title' => 'Employee invitation created',
                'message' => "{$employee->first_name} {$employee->last_name} has been invited to complete onboarding.",
                'action_label' => 'View employee',
                'action_url' => "/employees/{$employee->id}",
                'entity_type' => 'employee',
                'entity_id' => $employee->id,
            ]);
        }
    }

    public function employeeInvitationAccepted(EmployeeInvitation $invitation): void
    {
        $invitation->loadMissing(['employee', 'invitedBy']);
        $employee = $invitation->employee;

        if (! $invitation->invitedBy || ! $employee) {
            return;
        }

        $this->notify($invitation->invitedBy, [
            'category' => 'employee_onboarding',
            'event' => 'employee.invitation_accepted',
            'title' => 'Employee accepted invitation',
            'message' => "{$employee->first_name} {$employee->last_name} has accepted the invitation and started onboarding.",
            'action_label' => 'View employee',
            'action_url' => "/employees/{$employee->id}",
            'entity_type' => 'employee',
            'entity_id' => $employee->id,
        ]);
    }

    public function approvalSubmitted(ApprovalRequest $approvalRequest): void
    {
        $approvalRequest->loadMissing(['workflow.steps', 'requester', 'subjectEmployee.user']);
        $step = $this->currentStep($approvalRequest);

        foreach ($this->approvalRecipients($approvalRequest, $step) as $recipient) {
            $this->notify($recipient, [
                'category' => 'approvals',
                'event' => 'approval.submitted',
                'title' => 'Approval request pending',
                'message' => $approvalRequest->title,
                'action_label' => 'Review approval',
                'action_url' => "/approvals/{$approvalRequest->id}",
                'entity_type' => 'approval_request',
                'entity_id' => $approvalRequest->id,
                'metadata' => [
                    'module' => $approvalRequest->module,
                    'action' => $approvalRequest->action,
                    'status' => $approvalRequest->status,
                    'current_step_order' => $approvalRequest->current_step_order,
                ],
            ]);
        }
    }

    public function approvalDecided(ApprovalRequest $approvalRequest, User $actor): void
    {
        $approvalRequest->loadMissing(['requester', 'subjectEmployee.user', 'workflow.steps']);

        if ($approvalRequest->status === 'pending') {
            $this->approvalSubmitted($approvalRequest);

            return;
        }

        $recipients = collect([$approvalRequest->requester, $approvalRequest->subjectEmployee?->user])
            ->filter()
            ->reject(fn (User $user) => $user->id === $actor->id)
            ->unique('id');

        foreach ($recipients as $recipient) {
            $this->notify($recipient, [
                'category' => 'approvals',
                'event' => 'approval.decided',
                'severity' => in_array($approvalRequest->status, ['rejected', 'changes_requested'], true) ? 'warning' : 'info',
                'title' => 'Approval request updated',
                'message' => "{$approvalRequest->title} is now {$approvalRequest->status}.",
                'action_label' => 'View approval',
                'action_url' => "/approvals/{$approvalRequest->id}",
                'entity_type' => 'approval_request',
                'entity_id' => $approvalRequest->id,
                'metadata' => [
                    'module' => $approvalRequest->module,
                    'action' => $approvalRequest->action,
                    'status' => $approvalRequest->status,
                    'decided_by_user_id' => $actor->id,
                ],
            ]);
        }
    }

    /**
     * @return Collection<int, User>
     */
    private function approvalRecipients(ApprovalRequest $approvalRequest, ?ApprovalWorkflowStep $step): Collection
    {
        if (! $step) {
            return User::query()
                ->where('organization_id', $approvalRequest->organization_id)
                ->get()
                ->filter(fn (User $user) => $user->can('approvals.action'))
                ->values();
        }

        $users = User::query()
            ->where('organization_id', $approvalRequest->organization_id)
            ->with('employee')
            ->get();

        return $users
            ->filter(function (User $user) use ($approvalRequest, $step): bool {
                if ($user->hasAnyRole(['Super Admin', 'Organization Admin'])) {
                    return true;
                }

                return match ($step->approver_type) {
                    'permission' => $step->approver_permission && $user->can($step->approver_permission),
                    'role' => $step->approver_role && $user->hasRole($step->approver_role),
                    'direct_manager' => $approvalRequest->subjectEmployee && $user->employee?->id === $approvalRequest->subjectEmployee->reporting_manager_id,
                    'department_head' => $approvalRequest->subjectEmployee && $user->hasRole('Department Head') && $user->employee?->department_id === $approvalRequest->subjectEmployee->department_id,
                    default => false,
                };
            })
            ->unique('id')
            ->values();
    }

    private function currentStep(ApprovalRequest $approvalRequest): ?ApprovalWorkflowStep
    {
        return $approvalRequest->workflow?->steps
            ->where('is_active', true)
            ->where('step_order', $approvalRequest->current_step_order)
            ->first();
    }
}
