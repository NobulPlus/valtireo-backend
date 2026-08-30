<?php

namespace App\Services;

use App\Models\ApprovalRequest;
use App\Models\ApprovalWorkflowStep;
use App\Models\Department;
use App\Models\EmployeeDocument;
use App\Models\EmployeeInvitation;
use App\Models\Organization;
use App\Models\Ticket;
use App\Models\TicketComment;
use App\Models\User;
use App\Notifications\ValtireoNotification;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;
use Throwable;

class NotificationDispatchService
{
    /**
     * Delivery is best-effort: a broken mail transport (bad SMTP creds, provider
     * outage) must never roll back the business action that triggered it — e.g.
     * an approval decision recorded inside a DB transaction. Failures are logged,
     * not raised.
     *
     * @param array<string, mixed> $data
     */
    public function notify(User $user, array $data): void
    {
        try {
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
        } catch (Throwable $exception) {
            Log::error('Notification dispatch failed', [
                'user_id' => $user->id,
                'event' => $data['event'] ?? null,
                'message' => $exception->getMessage(),
            ]);
        }
    }

    public function organizationAdminInvited(
        User $admin,
        Organization $organization,
        string $temporaryPassword,
        User $createdBy
    ): void {
        $this->notify($admin, [
            'category' => 'organization_onboarding',
            'event' => 'organization.admin_invited',
            'title' => "Welcome to {$organization->name} on Valtireo",
            'message' => "You have been invited as the Organization Admin for {$organization->name}. Use the temporary password below to sign in, then complete your workspace setup.",
            'action_label' => 'Sign in to Valtireo',
            'action_url' => '/login',
            'entity_type' => 'organization',
            'entity_id' => $organization->id,
            'metadata' => [
                'organization_code' => $organization->code,
                'temporary_password' => $temporaryPassword,
                'provisioned_by' => $createdBy->email,
            ],
        ]);
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
            [$actionLabel, $actionUrl] = $this->decidedActionFor($approvalRequest, $recipient);

            $this->notify($recipient, [
                'category' => 'approvals',
                'event' => 'approval.decided',
                'severity' => in_array($approvalRequest->status, ['rejected', 'changes_requested'], true) ? 'warning' : 'info',
                'title' => 'Approval request updated',
                'message' => "{$approvalRequest->title} is now {$approvalRequest->status}.",
                'action_label' => $actionLabel,
                'action_url' => $actionUrl,
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
     * The requester/subject on a decided approval isn't necessarily anyone
     * who can view the Approvals page itself (an ordinary employee whose
     * own leave or document was decided on, for instance) — sending them a
     * link to a page that 403s them is worse than no link at all. Route
     * them to wherever their own copy of the record actually lives instead.
     *
     * @return array{0: string|null, 1: string|null}
     */
    private function decidedActionFor(ApprovalRequest $approvalRequest, User $recipient): array
    {
        if ($recipient->can('approvals.view')) {
            return ['View approval', "/approvals/{$approvalRequest->id}"];
        }

        $isSubject = $approvalRequest->subjectEmployee?->user_id === $recipient->id;

        if ($isSubject && $approvalRequest->module === 'employee_documents') {
            return ['View my documents', '/me/profile?tab=documents'];
        }

        if ($isSubject && $approvalRequest->module === 'leave') {
            return ['View my leave', '/me/leave'];
        }

        if ($isSubject && $approvalRequest->module === 'service_desk') {
            return ['View my tickets', '/me/tickets'];
        }

        return [null, null];
    }

    public function ticketAssigned(Ticket $ticket): void
    {
        $ticket->loadMissing(['assignedTo', 'employee', 'category']);
        $recipient = $ticket->assignedTo;

        if (! $recipient) {
            return;
        }

        $this->notify($recipient, [
            'category' => 'service_desk',
            'event' => 'ticket.assigned',
            'title' => 'A ticket has been assigned to you',
            'message' => "\"{$ticket->subject}\" ({$ticket->category?->name}) has been assigned to you.",
            'action_label' => 'View ticket',
            'action_url' => "/service-desk?ticket={$ticket->id}",
            'entity_type' => 'ticket',
            'entity_id' => $ticket->id,
            'metadata' => [
                'ticket_category_id' => $ticket->ticket_category_id,
            ],
        ]);
    }

    /**
     * Additional targeting on top of the normal category-workflow
     * notification: alerts service-desk resolvers who belong to the ticket's
     * chosen destination department, so a ticket explicitly routed to e.g.
     * Facilities reaches people on that team even if the category's own
     * workflow step routes more broadly (or to a different role).
     */
    public function ticketDepartmentAlert(Ticket $ticket, Department $department, User $submitter): void
    {
        $ticket->loadMissing('category');

        $recipients = User::query()
            ->where('organization_id', $ticket->organization_id)
            ->with('employee')
            ->get()
            ->filter(fn (User $user) => $user->employee?->department_id === $department->id && $user->can('service_desk.view'))
            ->reject(fn (User $user) => $user->id === $submitter->id);

        foreach ($recipients as $recipient) {
            $this->notify($recipient, [
                'category' => 'service_desk',
                'event' => 'ticket.department_alert',
                'title' => "New ticket for {$department->name}",
                'message' => "\"{$ticket->subject}\" ({$ticket->category?->name}) was routed to {$department->name}.",
                'action_label' => 'View ticket',
                'action_url' => "/service-desk?ticket={$ticket->id}",
                'entity_type' => 'ticket',
                'entity_id' => $ticket->id,
                'metadata' => [
                    'ticket_category_id' => $ticket->ticket_category_id,
                    'department_id' => $department->id,
                ],
            ]);
        }
    }

    public function ticketCommentAdded(Ticket $ticket, TicketComment $comment, User $author): void
    {
        $ticket->loadMissing(['assignedTo', 'employee.user', 'category', 'watchers.user']);
        $isEmployeeAuthor = $ticket->employee?->user_id === $author->id;
        $watchers = $ticket->watchers
            ->pluck('user')
            ->filter();

        $recipients = $isEmployeeAuthor
            ? $this->ticketResolverRecipients($ticket)
            : collect([$ticket->employee?->user])->filter();

        $recipients = $recipients
            ->merge($watchers)
            ->unique('id')
            ->values();

        foreach ($recipients->reject(fn (User $user) => $user->id === $author->id) as $recipient) {
            $this->notify($recipient, [
                'category' => 'service_desk',
                'event' => 'ticket.comment_added',
                'title' => 'New reply on a ticket',
                'message' => "{$author->name} replied on \"{$ticket->subject}\".",
                'action_label' => $isEmployeeAuthor ? 'View ticket' : 'View my tickets',
                'action_url' => $isEmployeeAuthor ? "/service-desk?ticket={$ticket->id}" : '/me/tickets',
                'entity_type' => 'ticket',
                'entity_id' => $ticket->id,
                'metadata' => [
                    'ticket_comment_id' => $comment->id,
                ],
            ]);
        }
    }

    /**
     * @return Collection<int, User>
     */
    private function ticketResolverRecipients(Ticket $ticket): Collection
    {
        if ($ticket->assignedTo) {
            return collect([$ticket->assignedTo]);
        }

        return User::query()
            ->where('organization_id', $ticket->organization_id)
            ->get()
            ->filter(fn (User $user) => $user->can('service_desk.view'))
            ->values();
    }

    public function documentNeedsAcknowledgment(EmployeeDocument $document): void
    {
        $document->loadMissing(['employee.user', 'documentType', 'uploadedBy']);
        $recipient = $document->employee?->user;

        if (! $recipient) {
            return;
        }

        $this->notify($recipient, [
            'category' => 'documents',
            'event' => 'document.needs_acknowledgment',
            'severity' => 'warning',
            'title' => 'A document needs your acknowledgment',
            'message' => "{$document->uploadedBy?->name} added \"{$document->title}\" to your documents. Review it and confirm you've received it.",
            'action_label' => 'Review document',
            'action_url' => '/me/profile?tab=documents',
            'entity_type' => 'employee_document',
            'entity_id' => $document->id,
            'metadata' => [
                'document_type_id' => $document->document_type_id,
                'uploaded_by_id' => $document->uploaded_by_id,
            ],
        ]);
    }

    public function documentNeedsSignature(EmployeeDocument $document): void
    {
        $document->loadMissing(['employee.user', 'documentType', 'uploadedBy']);
        $recipient = $document->employee?->user;

        if (! $recipient) {
            return;
        }

        $this->notify($recipient, [
            'category' => 'documents',
            'event' => 'document.needs_signature',
            'severity' => 'warning',
            'title' => 'A document needs your signature',
            'message' => "{$document->uploadedBy?->name} added \"{$document->title}\" for you to sign. Download it, sign it, and upload the signed copy.",
            'action_label' => 'View document',
            'action_url' => '/me/profile?tab=documents',
            'entity_type' => 'employee_document',
            'entity_id' => $document->id,
            'metadata' => [
                'document_type_id' => $document->document_type_id,
                'uploaded_by_id' => $document->uploaded_by_id,
            ],
        ]);
    }

    public function documentAcknowledged(EmployeeDocument $document): void
    {
        $document->loadMissing(['employee', 'uploadedBy']);
        $recipient = $document->uploadedBy;

        if (! $recipient || ! $document->employee) {
            return;
        }

        $this->notify($recipient, [
            'category' => 'documents',
            'event' => 'document.acknowledged',
            'title' => 'Document acknowledged',
            'message' => "{$document->employee->first_name} {$document->employee->last_name} acknowledged \"{$document->title}\".",
            'action_label' => 'View employee',
            'action_url' => "/employees/{$document->employee_id}",
            'entity_type' => 'employee_document',
            'entity_id' => $document->id,
        ]);
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
                if ($user->is_platform_admin || $user->can('organizations.administer')) {
                    return true;
                }

                return match ($step->approver_type) {
                    'permission' => $step->approver_permission && $user->can($step->approver_permission),
                    'role' => $step->approverRole && $user->hasRole($step->approverRole),
                    'direct_manager' => $approvalRequest->subjectEmployee && $user->employee?->id === $approvalRequest->subjectEmployee->reporting_manager_id,
                    'department_head' => $approvalRequest->subjectEmployee && $user->can('employees.view_department') && $user->employee?->department_id === $approvalRequest->subjectEmployee->department_id,
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
