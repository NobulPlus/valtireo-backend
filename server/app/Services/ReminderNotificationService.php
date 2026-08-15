<?php

namespace App\Services;

use App\Models\ApprovalRequest;
use App\Models\AttendanceCorrectionRequest;
use App\Models\Employee;
use App\Models\EmployeeDocument;
use App\Models\EmployeeInvitation;
use App\Models\LeaveRequest;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class ReminderNotificationService
{
    public function __construct(private readonly NotificationDispatchService $notifications)
    {
    }

    /**
     * @return array<string, int>
     */
    public function send(int $documentDays = 30, int $onboardingDays = 2, int $approvalDays = 1): array
    {
        return [
            'document_expiry' => $this->documentExpiryReminders($documentDays),
            'onboarding_follow_up' => $this->onboardingFollowUps($onboardingDays),
            'pending_approvals' => $this->pendingApprovalReminders($approvalDays),
        ];
    }

    private function documentExpiryReminders(int $days): int
    {
        $sent = 0;

        EmployeeDocument::query()
            ->with(['employee.user', 'employee.organization', 'documentType', 'requirement'])
            ->whereNotNull('expires_at')
            ->whereDate('expires_at', '>=', now()->toDateString())
            ->whereDate('expires_at', '<=', now()->addDays($days)->toDateString())
            ->whereIn('status', ['submitted', 'approved', 'changes_requested'])
            ->chunk(100, function ($documents) use (&$sent): void {
                foreach ($documents as $document) {
                    $employee = $document->employee;
                    $recipient = $employee?->user;

                    if (! $recipient) {
                        continue;
                    }

                    $reminderKey = "document_expiry:{$document->id}:{$document->expires_at?->toDateString()}";

                    if ($this->alreadySent($recipient, $reminderKey)) {
                        continue;
                    }

                    $this->notifications->notify($recipient, [
                        'category' => 'documents',
                        'event' => 'document.expiry_reminder',
                        'severity' => $document->expires_at?->isToday() ? 'warning' : 'info',
                        'title' => 'Document expiry reminder',
                        'message' => "{$document->title} expires on {$document->expires_at?->toFormattedDateString()}.",
                        'action_label' => 'View document',
                        'action_url' => "/documents/{$document->id}",
                        'entity_type' => 'employee_document',
                        'entity_id' => $document->id,
                        'metadata' => [
                            'reminder_key' => $reminderKey,
                            'employee_id' => $employee->id,
                            'expires_at' => $document->expires_at?->toDateString(),
                            'document_type_id' => $document->document_type_id,
                            'document_requirement_id' => $document->document_requirement_id,
                        ],
                    ]);

                    $sent++;
                }
            });

        return $sent;
    }

    private function onboardingFollowUps(int $days): int
    {
        $sent = 0;

        EmployeeInvitation::query()
            ->with(['employee.user', 'invitedBy'])
            ->where('status', 'pending')
            ->whereDate('created_at', '<=', now()->subDays($days)->toDateString())
            ->chunk(100, function ($invitations) use (&$sent): void {
                foreach ($invitations as $invitation) {
                    $employee = $invitation->employee;
                    $recipients = collect([$employee?->user, $invitation->invitedBy])->filter()->unique('id');

                    foreach ($recipients as $recipient) {
                        $reminderKey = "onboarding_follow_up:{$invitation->id}:{$recipient->id}";

                        if ($this->alreadySent($recipient, $reminderKey)) {
                            continue;
                        }

                        $this->notifications->notify($recipient, [
                            'category' => 'employee_onboarding',
                            'event' => 'employee.onboarding_follow_up',
                            'severity' => 'info',
                            'title' => 'Employee onboarding follow-up',
                            'message' => "{$employee->first_name} {$employee->last_name} has not completed the invitation yet.",
                            'action_label' => 'View employee',
                            'action_url' => "/employees/{$employee->id}",
                            'entity_type' => 'employee_invitation',
                            'entity_id' => $invitation->id,
                            'metadata' => [
                                'reminder_key' => $reminderKey,
                                'employee_id' => $employee->id,
                                'expires_at' => $invitation->expires_at?->toDateTimeString(),
                            ],
                        ]);

                        $sent++;
                    }
                }
            });

        return $sent;
    }

    private function pendingApprovalReminders(int $days): int
    {
        $sent = 0;
        $usersByOrganization = [];

        ApprovalRequest::query()
            ->with(['workflow.steps', 'requester', 'subjectEmployee.user'])
            ->where('status', 'pending')
            ->whereDate('submitted_at', '<=', now()->subDays($days)->toDateString())
            ->chunk(100, function ($approvals) use (&$sent, &$usersByOrganization): void {
                foreach ($approvals as $approval) {
                    $usersByOrganization[$approval->organization_id] ??= User::query()
                        ->where('organization_id', $approval->organization_id)
                        ->with('employee')
                        ->get();

                    foreach ($this->approvalRecipients($approval, $usersByOrganization[$approval->organization_id]) as $recipient) {
                        $reminderKey = "pending_approval:{$approval->id}:{$approval->current_step_order}:{$recipient->id}";

                        if ($this->alreadySent($recipient, $reminderKey)) {
                            continue;
                        }

                        $this->notifications->notify($recipient, [
                            'category' => 'approvals',
                            'event' => 'approval.pending_reminder',
                            'severity' => 'warning',
                            'title' => 'Approval reminder',
                            'message' => "{$approval->title} is still waiting for a decision.",
                            'action_label' => 'Review approval',
                            'action_url' => "/approvals/{$approval->id}",
                            'entity_type' => 'approval_request',
                            'entity_id' => $approval->id,
                            'metadata' => [
                                'reminder_key' => $reminderKey,
                                'module' => $approval->module,
                                'action' => $approval->action,
                                'status' => $approval->status,
                                'current_step_order' => $approval->current_step_order,
                            ],
                        ]);

                        $sent++;
                    }
                }
            });

        return $sent;
    }

    /**
     * @param Collection<int, User> $users
     *
     * @return Collection<int, User>
     */
    private function approvalRecipients(ApprovalRequest $approval, Collection $users): Collection
    {
        $step = $approval->workflow?->steps
            ->where('is_active', true)
            ->where('step_order', $approval->current_step_order)
            ->first();

        return $users
            ->filter(function (User $user) use ($approval, $step): bool {
                if ($user->hasAnyRole(['Super Admin', 'Organization Admin'])) {
                    return true;
                }

                if (! $step) {
                    return $user->can('approvals.action');
                }

                return match ($step->approver_type) {
                    'permission' => $step->approver_permission && $user->can($step->approver_permission),
                    'role' => $step->approver_role && $user->hasRole($step->approver_role),
                    'direct_manager' => $approval->subjectEmployee && $user->employee?->id === $approval->subjectEmployee->reporting_manager_id,
                    'department_head' => $approval->subjectEmployee && $user->hasRole('Department Head') && $user->employee?->department_id === $approval->subjectEmployee->department_id,
                    default => false,
                };
            })
            ->unique('id')
            ->values();
    }

    private function alreadySent(User $user, string $reminderKey): bool
    {
        return DB::table('notifications')
            ->where('notifiable_type', User::class)
            ->where('notifiable_id', $user->id)
            ->where('data->metadata->reminder_key', $reminderKey)
            ->exists();
    }
}
