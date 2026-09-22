<?php

namespace App\Services;

use App\Models\Asset;
use App\Models\Department;
use App\Models\ApprovalRequest;
use App\Models\ApprovalWorkflowStep;
use App\Models\Ticket;
use App\Models\TicketCategory;
use App\Models\TicketComment;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class TicketService
{
    private const TERMINAL_STATUSES = ['cancelled', 'rejected', 'resolved', 'closed'];
    private const WORKABLE_STATUSES = ['approved', 'in_progress', 'on_hold'];

    public function __construct(
        private readonly ApprovalRequestService $approvals,
        private readonly NotificationDispatchService $notifications,
        private readonly AssetService $assets,
    ) {
    }

    /**
     * @param array<string, mixed> $data
     */
    public function submit(User $actor, array $data): Ticket
    {
        return DB::transaction(function () use ($actor, $data): Ticket {
            $employee = $actor->employee()->firstOrFail();
            $category = TicketCategory::query()
                ->where('organization_id', $employee->organization_id)
                ->where('is_active', true)
                ->findOrFail($data['ticket_category_id']);

            $assignee = $this->resolverFor($employee->organization_id, $data['assigned_to_user_id'] ?? null);
            $department = ! empty($data['department_id'])
                ? Department::query()->where('organization_id', $employee->organization_id)->findOrFail($data['department_id'])
                : null;

            $attachment = $data['attachment'] ?? null;
            $attachmentPath = null;
            if ($attachment instanceof UploadedFile) {
                $attachmentPath = $attachment->store(
                    "organizations/{$employee->organization_id}/employees/{$employee->id}/tickets",
                    'local'
                );
            }

            $submittedAt = now();
            $isDirectlyRouted = $assignee !== null || $department !== null;

            try {
                $ticket = Ticket::query()->create([
                    'organization_id' => $employee->organization_id,
                    'employee_id' => $employee->id,
                    'requested_by_id' => $actor->id,
                    'ticket_category_id' => $category->id,
                    'department_id' => $department?->id,
                    'asset_id' => $data['asset_id'] ?? null,
                    'subject' => $data['subject'],
                    'description' => $data['description'],
                    'status' => $isDirectlyRouted ? 'approved' : 'submitted',
                    'priority' => $data['priority'] ?? 'medium',
                    'assigned_to_user_id' => $assignee?->id,
                    'attachment_file_name' => $attachment instanceof UploadedFile ? $attachment->getClientOriginalName() : null,
                    'attachment_file_path' => $attachmentPath,
                    'attachment_mime_type' => $attachment instanceof UploadedFile ? $attachment->getClientMimeType() : null,
                    'attachment_file_size' => $attachment instanceof UploadedFile ? $attachment->getSize() : null,
                    'submitted_at' => $submittedAt,
                    'reviewed_at' => $isDirectlyRouted ? $submittedAt : null,
                    'response_sla_due_at' => $category->response_sla_hours
                        ? $submittedAt->clone()->addHours($category->response_sla_hours)
                        : null,
                    'sla_due_at' => $category->resolution_sla_hours
                        ? $submittedAt->clone()->addHours($category->resolution_sla_hours)
                        : null,
                ]);

                $this->recordActivity($ticket, $actor, 'ticket_submitted', null, $ticket->status, null, [
                    'ticket_category_id' => $category->id,
                    'priority' => $ticket->priority,
                    'has_attachment' => $attachmentPath !== null,
                    'routed_directly' => $isDirectlyRouted,
                ]);

                $this->ensureWatcher($ticket, $actor);

                if ($ticket->asset_id) {
                    $asset = Asset::query()->find($ticket->asset_id);
                    if ($asset) {
                        $this->assets->reportFault($actor, $asset, "Reported via ticket: {$ticket->subject}", $ticket);
                    }
                }

                if (! $isDirectlyRouted) {
                    $this->approvals->submit(
                        $actor,
                        $ticket,
                        'service_desk',
                        strtolower($category->code),
                        "Review {$employee->first_name} {$employee->last_name}'s {$category->name} ticket: {$data['subject']}",
                        $employee,
                        [
                            'ticket_category_id' => $category->id,
                            'assigned_to_user_id' => $assignee?->id,
                            'department_id' => $department?->id,
                            'has_attachment' => $attachmentPath !== null,
                        ]
                    );
                }

                if ($assignee) {
                    $this->recordActivity($ticket, $actor, 'ticket_assigned', null, null, null, [
                        'assigned_to_user_id' => $assignee->id,
                    ]);
                    $this->notifications->ticketAssigned($ticket->refresh()->load('assignedTo'));
                }

                if ($department) {
                    $this->recordActivity($ticket, $actor, 'department_notified', null, null, null, [
                        'department_id' => $department->id,
                    ]);
                    $this->notifications->ticketDepartmentAlert($ticket, $department, $actor);
                }
            } catch (\Throwable $exception) {
                if ($attachmentPath) {
                    Storage::disk('local')->delete($attachmentPath);
                }

                throw $exception;
            }

            return $ticket->refresh()->load($this->relations());
        });
    }

    public function cancel(User $actor, Ticket $ticket): Ticket
    {
        $this->assertTicketVisibleTo($actor, $ticket);

        if (! in_array($ticket->status, ['submitted', 'changes_requested', 'approved'], true)) {
            throw ValidationException::withMessages([
                'status' => ['Only a ticket that has not yet started work can be cancelled.'],
            ]);
        }

        return DB::transaction(function () use ($actor, $ticket): Ticket {
            $previousStatus = $ticket->status;
            $ticket->update([
                'status' => 'cancelled',
                'reviewed_at' => now(),
            ]);

            $this->cancelPendingApproval($ticket, $actor);

            $this->recordActivity($ticket, $actor, 'ticket_cancelled', $previousStatus, 'cancelled');

            return $ticket->refresh()->load($this->relations());
        });
    }

    public function assign(User $actor, Ticket $ticket, ?int $assignedToUserId): Ticket
    {
        $this->assertResolverCanWork($actor, $ticket);
        $this->assertNotTerminal($ticket);

        $assignee = $this->resolverFor($ticket->organization_id, $assignedToUserId);
        $previousAssigneeId = $ticket->assigned_to_user_id;
        $changed = $previousAssigneeId !== $assignedToUserId;

        $ticket->update(['assigned_to_user_id' => $assignedToUserId]);

        if ($changed) {
            $this->recordActivity($ticket, $actor, $assignedToUserId ? 'ticket_assigned' : 'ticket_unassigned', null, null, null, [
                'previous_assigned_to_user_id' => $previousAssigneeId,
                'assigned_to_user_id' => $assignedToUserId,
            ]);
        }

        if ($assignee) {
            $this->ensureWatcher($ticket, $assignee);
        }

        $ticket = $ticket->refresh()->load($this->relations());

        if ($changed && $assignee) {
            $this->notifications->ticketAssigned($ticket);
        }

        return $ticket;
    }

    public function updatePriority(User $actor, Ticket $ticket, string $priority): Ticket
    {
        $this->assertResolverCanWork($actor, $ticket);
        $this->assertNotTerminal($ticket);

        $previousPriority = $ticket->priority;
        $ticket->update(['priority' => $priority]);

        if ($previousPriority !== $priority) {
            $this->recordActivity($ticket, $actor, 'priority_changed', null, null, null, [
                'previous_priority' => $previousPriority,
                'priority' => $priority,
            ]);
        }

        return $ticket->refresh()->load($this->relations());
    }

    public function start(User $actor, Ticket $ticket, ?string $note = null): Ticket
    {
        $this->assertResolverCanWork($actor, $ticket);

        if (! in_array($ticket->status, ['approved', 'on_hold'], true)) {
            throw ValidationException::withMessages([
                'status' => ['Only an approved or on-hold ticket can be moved into progress.'],
            ]);
        }

        return DB::transaction(function () use ($actor, $ticket, $note): Ticket {
            $previousStatus = $ticket->status;
            $ticket->update([
                'status' => 'in_progress',
                'first_responded_at' => $ticket->first_responded_at ?? now(),
                'on_hold_at' => null,
                'hold_reason' => null,
            ]);

            $this->recordActivity($ticket, $actor, 'work_started', $previousStatus, 'in_progress', $note);

            return $ticket->refresh()->load($this->relations());
        });
    }

    public function hold(User $actor, Ticket $ticket, string $reason): Ticket
    {
        $this->assertResolverCanWork($actor, $ticket);

        if (! in_array($ticket->status, ['approved', 'in_progress'], true)) {
            throw ValidationException::withMessages([
                'status' => ['Only an approved or in-progress ticket can be placed on hold.'],
            ]);
        }

        return DB::transaction(function () use ($actor, $ticket, $reason): Ticket {
            $previousStatus = $ticket->status;
            $ticket->update([
                'status' => 'on_hold',
                'first_responded_at' => $ticket->first_responded_at ?? now(),
                'on_hold_at' => now(),
                'hold_reason' => $reason,
            ]);

            $this->recordActivity($ticket, $actor, 'ticket_on_hold', $previousStatus, 'on_hold', $reason);

            return $ticket->refresh()->load($this->relations());
        });
    }

    public function resume(User $actor, Ticket $ticket, ?string $note = null): Ticket
    {
        $this->assertResolverCanWork($actor, $ticket);

        if ($ticket->status !== 'on_hold') {
            throw ValidationException::withMessages([
                'status' => ['Only an on-hold ticket can be resumed.'],
            ]);
        }

        return DB::transaction(function () use ($actor, $ticket, $note): Ticket {
            $holdStartedAt = $ticket->on_hold_at;
            $holdSeconds = $holdStartedAt ? $holdStartedAt->diffInSeconds(now()) : 0;
            $ticket->update([
                'status' => 'in_progress',
                'on_hold_at' => null,
                'hold_reason' => null,
                'response_sla_due_at' => $ticket->response_sla_due_at && ! $ticket->first_responded_at
                    ? $ticket->response_sla_due_at->clone()->addSeconds($holdSeconds)
                    : $ticket->response_sla_due_at,
                'sla_due_at' => $ticket->sla_due_at
                    ? $ticket->sla_due_at->clone()->addSeconds($holdSeconds)
                    : null,
            ]);

            $this->recordActivity($ticket, $actor, 'ticket_resumed', 'on_hold', 'in_progress', $note);

            return $ticket->refresh()->load($this->relations());
        });
    }

    public function escalate(User $actor, Ticket $ticket, ?int $assignedToUserId = null, ?string $priority = null, ?string $note = null): Ticket
    {
        $this->assertResolverCanWork($actor, $ticket);
        $this->assertNotTerminal($ticket);

        $assignee = $this->resolverFor($ticket->organization_id, $assignedToUserId);
        $previousAssigneeId = $ticket->assigned_to_user_id;
        $previousPriority = $ticket->priority;
        $nextEscalationLevel = ((int) $ticket->escalation_level) + 1;

        $ticket->update([
            'assigned_to_user_id' => $assignedToUserId ?: $ticket->assigned_to_user_id,
            'priority' => $priority ?: $ticket->priority,
            'escalation_level' => $nextEscalationLevel,
            'escalated_at' => now(),
        ]);

        if ($assignee) {
            $this->ensureWatcher($ticket, $assignee);
        }

        $this->recordActivity($ticket, $actor, 'ticket_escalated', null, null, $note, [
            'previous_assigned_to_user_id' => $previousAssigneeId,
            'assigned_to_user_id' => $assignedToUserId ?: $previousAssigneeId,
            'previous_priority' => $previousPriority,
            'priority' => $priority ?: $previousPriority,
            'escalation_level' => $nextEscalationLevel,
        ]);

        $ticket = $ticket->refresh()->load($this->relations());

        if ($assignee && $previousAssigneeId !== $assignee->id) {
            $this->notifications->ticketAssigned($ticket);
        }

        return $ticket;
    }

    /**
     * The lightweight replacement for the old approval engine's
     * reject/request-changes decisions on a ticket: sends it back to the
     * requester with a reason, without reassigning it (reassigning to
     * someone else is already covered by assign()/escalate()).
     */
    public function decline(User $actor, Ticket $ticket, string $reason): Ticket
    {
        $this->assertResolverCanWork($actor, $ticket);

        if (! in_array($ticket->status, ['submitted', 'approved'], true)) {
            throw ValidationException::withMessages([
                'status' => ['Only a submitted or approved ticket that has not started work can be declined.'],
            ]);
        }

        return DB::transaction(function () use ($actor, $ticket, $reason): Ticket {
            $previousStatus = $ticket->status;
            $pendingApproval = $this->pendingApproval($ticket);

            if ($pendingApproval) {
                $this->approvals->act($actor, $pendingApproval, 'request_changes', $reason);
                $ticket->refresh();
            }

            if ($ticket->status !== 'changes_requested') {
                $ticket->update([
                    'status' => 'changes_requested',
                    'reviewed_at' => now(),
                ]);
            }

            $this->recordActivity($ticket, $actor, 'ticket_declined', $previousStatus, 'changes_requested', $reason);
            $this->addComment($actor, $ticket->refresh(), [
                'comment' => $reason,
                'visibility' => 'public',
            ]);

            return $ticket->refresh()->load($this->relations());
        });
    }

    public function resolve(User $actor, Ticket $ticket, ?string $note = null): Ticket
    {
        $this->assertResolverCanWork($actor, $ticket);

        if (! in_array($ticket->status, self::WORKABLE_STATUSES, true)) {
            throw ValidationException::withMessages([
                'status' => ['Only an approved, in-progress or on-hold ticket can be resolved.'],
            ]);
        }

        return DB::transaction(function () use ($actor, $ticket, $note): Ticket {
            $previousStatus = $ticket->status;
            $ticket->update([
                'status' => 'resolved',
                'first_responded_at' => $ticket->first_responded_at ?? now(),
                'resolved_at' => now(),
                'on_hold_at' => null,
                'hold_reason' => null,
            ]);

            $this->recordActivity($ticket, $actor, 'ticket_resolved', $previousStatus, 'resolved', $note);

            if ($ticket->asset_id) {
                $asset = Asset::query()->find($ticket->asset_id);
                if ($asset && $asset->status === 'maintenance') {
                    $this->assets->returnToService($actor, $asset, "Returned to service — ticket resolved: {$ticket->subject}", $ticket);
                }
            }

            if (filled($note)) {
                $this->addComment($actor, $ticket->refresh(), [
                    'comment' => $note,
                    'visibility' => 'public',
                ]);
            }

            return $ticket->refresh()->load($this->relations());
        });
    }

    public function close(User $actor, Ticket $ticket, ?int $rating = null, ?string $comment = null): Ticket
    {
        $this->assertTicketVisibleTo($actor, $ticket);
        $this->assertCanClose($actor, $ticket);

        if ($ticket->status !== 'resolved') {
            throw ValidationException::withMessages([
                'status' => ['Only a resolved ticket can be closed.'],
            ]);
        }

        return DB::transaction(function () use ($actor, $ticket, $rating, $comment): Ticket {
            $ticket->update([
                'status' => 'closed',
                'closed_at' => now(),
                'satisfaction_rating' => $rating,
                'satisfaction_comment' => $comment,
            ]);

            $this->recordActivity($ticket, $actor, 'ticket_closed', 'resolved', 'closed', $comment, [
                'satisfaction_rating' => $rating,
            ]);

            return $ticket->refresh()->load($this->relations());
        });
    }

    public function reopen(User $actor, Ticket $ticket, string $reason): Ticket
    {
        $this->assertResolverCanWork($actor, $ticket);

        if (! in_array($ticket->status, ['resolved', 'closed'], true)) {
            throw ValidationException::withMessages([
                'status' => ['Only a resolved or closed ticket can be reopened.'],
            ]);
        }

        return DB::transaction(function () use ($actor, $ticket, $reason): Ticket {
            $previousStatus = $ticket->status;
            $ticket->update([
                'status' => 'in_progress',
                'resolved_at' => null,
                'closed_at' => null,
                'satisfaction_rating' => null,
                'satisfaction_comment' => null,
            ]);

            $this->recordActivity($ticket, $actor, 'ticket_reopened', $previousStatus, 'in_progress', $reason);
            $this->addComment($actor, $ticket->refresh(), [
                'comment' => "Reopened: {$reason}",
                'visibility' => 'public',
            ]);

            return $ticket->refresh()->load($this->relations());
        });
    }

    /**
     * @param array<string, mixed> $data
     */
    public function resubmit(User $actor, Ticket $ticket, array $data): Ticket
    {
        $this->assertTicketVisibleTo($actor, $ticket);

        if ($actor->employee?->id !== $ticket->employee_id && ! $actor->can('service_desk.view')) {
            abort(403);
        }

        if ($ticket->status !== 'changes_requested') {
            throw ValidationException::withMessages([
                'status' => ['Only a ticket with requested changes can be resubmitted.'],
            ]);
        }

        return DB::transaction(function () use ($actor, $ticket, $data): Ticket {
            $category = ! empty($data['ticket_category_id'])
                ? TicketCategory::query()
                    ->where('organization_id', $ticket->organization_id)
                    ->where('is_active', true)
                    ->findOrFail($data['ticket_category_id'])
                : $ticket->category()->firstOrFail();
            $assignee = array_key_exists('assigned_to_user_id', $data)
                ? $this->resolverFor($ticket->organization_id, $data['assigned_to_user_id'])
                : $ticket->assignedTo;
            $department = array_key_exists('department_id', $data) && ! empty($data['department_id'])
                ? Department::query()->where('organization_id', $ticket->organization_id)->findOrFail($data['department_id'])
                : (array_key_exists('department_id', $data) ? null : $ticket->department);
            $attachment = $data['attachment'] ?? null;
            $attachmentPath = null;

            if ($attachment instanceof UploadedFile) {
                $attachmentPath = $attachment->store(
                    "organizations/{$ticket->organization_id}/employees/{$ticket->employee_id}/tickets",
                    'local'
                );
            }

            try {
                $previousStatus = $ticket->status;
                $submittedAt = now();
                $isDirectlyRouted = $assignee !== null || $department !== null;
                $update = [
                    'ticket_category_id' => $category->id,
                    'department_id' => $department?->id,
                    'assigned_to_user_id' => $assignee?->id,
                    'subject' => $data['subject'] ?? $ticket->subject,
                    'description' => $data['description'] ?? $ticket->description,
                    'priority' => $data['priority'] ?? $ticket->priority,
                    'status' => $isDirectlyRouted ? 'approved' : 'submitted',
                    'submitted_at' => $submittedAt,
                    'reviewed_at' => $isDirectlyRouted ? $submittedAt : null,
                    'first_responded_at' => null,
                    'response_sla_due_at' => $category->response_sla_hours
                        ? $submittedAt->clone()->addHours($category->response_sla_hours)
                        : null,
                    'sla_due_at' => $category->resolution_sla_hours
                        ? $submittedAt->clone()->addHours($category->resolution_sla_hours)
                        : null,
                ];

                if ($attachment instanceof UploadedFile) {
                    $update = [
                        ...$update,
                        'attachment_file_name' => $attachment->getClientOriginalName(),
                        'attachment_file_path' => $attachmentPath,
                        'attachment_mime_type' => $attachment->getClientMimeType(),
                        'attachment_file_size' => $attachment->getSize(),
                    ];
                }

                $ticket->update($update);

                $this->recordActivity($ticket, $actor, 'ticket_resubmitted', $previousStatus, $isDirectlyRouted ? 'approved' : 'submitted', null, [
                    'ticket_category_id' => $category->id,
                    'assigned_to_user_id' => $assignee?->id,
                    'department_id' => $department?->id,
                    'has_attachment' => $attachmentPath !== null,
                    'routed_directly' => $isDirectlyRouted,
                ]);

                if (! $isDirectlyRouted) {
                    $this->approvals->submit(
                        $actor,
                        $ticket->refresh(),
                        'service_desk',
                        strtolower($category->code),
                        "Review resubmitted ticket: {$ticket->subject}",
                        $ticket->employee,
                        [
                            'ticket_category_id' => $category->id,
                            'assigned_to_user_id' => $assignee?->id,
                            'department_id' => $department?->id,
                            'has_attachment' => $attachmentPath !== null,
                        ]
                    );
                }
            } catch (\Throwable $exception) {
                if ($attachmentPath) {
                    Storage::disk('local')->delete($attachmentPath);
                }

                throw $exception;
            }

            return $ticket->refresh()->load($this->relations());
        });
    }

    /**
     * @param array<string, mixed> $data
     */
    public function addComment(User $actor, Ticket $ticket, array $data): TicketComment
    {
        $this->assertTicketVisibleTo($actor, $ticket);

        $visibility = $data['visibility'] ?? 'public';
        if ($visibility === 'internal' && ! $actor->can('service_desk.view')) {
            throw ValidationException::withMessages([
                'visibility' => ['Only service desk staff can add internal notes.'],
            ]);
        }

        $attachment = $data['attachment'] ?? null;
        $attachmentPath = null;
        if ($attachment instanceof UploadedFile) {
            $attachmentPath = $attachment->store(
                "organizations/{$ticket->organization_id}/tickets/{$ticket->id}/comments",
                'local'
            );
        }

        try {
            $ticketComment = $ticket->comments()->create([
                'user_id' => $actor->id,
                'comment' => $data['comment'],
                'visibility' => $visibility,
                'attachment_file_name' => $attachment instanceof UploadedFile ? $attachment->getClientOriginalName() : null,
                'attachment_file_path' => $attachmentPath,
                'attachment_mime_type' => $attachment instanceof UploadedFile ? $attachment->getClientMimeType() : null,
                'attachment_file_size' => $attachment instanceof UploadedFile ? $attachment->getSize() : null,
            ]);
        } catch (\Throwable $exception) {
            if ($attachmentPath) {
                Storage::disk('local')->delete($attachmentPath);
            }

            throw $exception;
        }

        $this->recordActivity($ticket, $actor, $visibility === 'internal' ? 'internal_note_added' : 'comment_added', null, null, null, [
            'ticket_comment_id' => $ticketComment->id,
            'has_attachment' => $attachmentPath !== null,
        ], $visibility);

        if ($visibility === 'public') {
            $this->notifications->ticketCommentAdded($ticket, $ticketComment, $actor);
        }

        return $ticketComment->load('user');
    }

    public function watch(User $actor, Ticket $ticket): Ticket
    {
        $this->assertTicketVisibleTo($actor, $ticket);

        $ticket->watchers()->firstOrCreate([
            'user_id' => $actor->id,
        ], [
            'organization_id' => $ticket->organization_id,
        ]);

        $this->recordActivity($ticket, $actor, 'watcher_added', null, null, null, [
            'user_id' => $actor->id,
        ], $actor->can('service_desk.view') ? 'internal' : 'public');

        return $ticket->refresh()->load($this->relations());
    }

    public function unwatch(User $actor, Ticket $ticket): Ticket
    {
        $this->assertTicketVisibleTo($actor, $ticket);

        $ticket->watchers()->where('user_id', $actor->id)->delete();

        $this->recordActivity($ticket, $actor, 'watcher_removed', null, null, null, [
            'user_id' => $actor->id,
        ], $actor->can('service_desk.view') ? 'internal' : 'public');

        return $ticket->refresh()->load($this->relations());
    }

    public function assertCommentAttachmentVisibleTo(User $actor, Ticket $ticket, TicketComment $comment): void
    {
        $this->assertTicketVisibleTo($actor, $ticket);
        abort_unless($comment->ticket_id === $ticket->id, 404);

        if ($comment->visibility === 'internal' && ! $actor->can('service_desk.view')) {
            abort(403);
        }
    }

    /**
     * @return array<int, string>
     */
    public function relations(): array
    {
        return [
            'employee',
            'requestedBy',
            'assignedTo',
            'asset',
            'category',
            'department',
            'comments.user',
            'activities.actor',
            'watchers.user',
            'approvalRequests.approvable',
            'approvalRequests.workflow.steps',
            'approvalRequests.decisions.actor',
        ];
    }

    private function assertTicketVisibleTo(User $actor, Ticket $ticket): void
    {
        if ($ticket->organization_id !== $actor->organization_id) {
            abort(404);
        }

        if (! $actor->can('service_desk.view') && $actor->employee?->id !== $ticket->employee_id && $actor->id !== $ticket->assigned_to_user_id) {
            abort(403);
        }
    }

    private function assertResolverCanWork(User $actor, Ticket $ticket): void
    {
        if ($ticket->organization_id !== $actor->organization_id) {
            abort(404);
        }

        if (! $this->canWorkTicket($actor, $ticket)) {
            abort(403);
        }
    }

    private function assertNotTerminal(Ticket $ticket): void
    {
        if (in_array($ticket->status, self::TERMINAL_STATUSES, true)) {
            throw ValidationException::withMessages([
                'status' => ['This ticket is already terminal and cannot be changed.'],
            ]);
        }
    }

    private function resolverFor(int $organizationId, mixed $userId): ?User
    {
        if (! $userId) {
            return null;
        }

        $resolver = User::query()->find($userId);

        if (! $resolver || $resolver->organization_id !== $organizationId || $resolver->employee?->status !== 'active') {
            throw ValidationException::withMessages([
                'assigned_to_user_id' => ['The selected assignee must be an active employee in this organization.'],
            ]);
        }

        return $resolver;
    }

    private function assertCanClose(User $actor, Ticket $ticket): void
    {
        if ($actor->is_platform_admin || $actor->can('organizations.administer')) {
            return;
        }

        if ($actor->employee?->id === $ticket->employee_id) {
            return;
        }

        abort(403);
    }

    private function canWorkTicket(User $actor, Ticket $ticket): bool
    {
        if ($actor->is_platform_admin || $actor->can('organizations.administer')) {
            return true;
        }

        if ($actor->id === $ticket->assigned_to_user_id) {
            return true;
        }

        if (! $actor->can('service_desk.view')) {
            return false;
        }

        if ($ticket->department_id && $actor->employee?->department_id === $ticket->department_id) {
            return true;
        }

        return $this->actorMatchesServiceDeskWorkflow($actor, $ticket);
    }

    private function actorMatchesServiceDeskWorkflow(User $actor, Ticket $ticket): bool
    {
        $ticket->loadMissing(['category', 'approvalRequests.workflow.steps.approverRole', 'employee.department']);
        $workflow = $ticket->approvalRequests
            ->where('module', 'service_desk')
            ->sortByDesc('id')
            ->first()
            ?->workflow;

        if (! $workflow) {
            return false;
        }

        return $workflow->steps
            ->where('is_active', true)
            ->contains(fn (ApprovalWorkflowStep $step): bool => $this->actorMatchesStep($actor, $ticket, $step));
    }

    private function actorMatchesStep(User $actor, Ticket $ticket, ApprovalWorkflowStep $step): bool
    {
        $subjectEmployee = $ticket->employee;

        return match ($step->approver_type) {
            'permission' => $step->approver_permission && $actor->can($step->approver_permission),
            'role' => $step->approverRole && $actor->hasRole($step->approverRole),
            'direct_manager' => $subjectEmployee && $actor->employee?->id === $subjectEmployee->reporting_manager_id,
            'department_head' => $subjectEmployee && $actor->employee?->id === $subjectEmployee->department?->head_employee_id,
            default => false,
        };
    }

    private function pendingApproval(Ticket $ticket): ?ApprovalRequest
    {
        return $ticket->approvalRequests()
            ->where('module', 'service_desk')
            ->where('status', 'pending')
            ->latest('id')
            ->first();
    }

    private function cancelPendingApproval(Ticket $ticket, User $actor): void
    {
        $approval = $this->pendingApproval($ticket);

        if (! $approval) {
            return;
        }

        $approval->decisions()->create([
            'approval_workflow_step_id' => null,
            'actor_id' => $actor->id,
            'action' => 'cancel',
            'previous_status' => $approval->status,
            'next_status' => 'cancelled',
            'note' => 'Ticket was cancelled before approval completed.',
            'metadata' => ['source' => 'ticket_cancel'],
        ]);

        $approval->update([
            'status' => 'cancelled',
            'current_step_order' => null,
            'completed_at' => now(),
        ]);
    }

    private function ensureWatcher(Ticket $ticket, User $user): void
    {
        $ticket->watchers()->firstOrCreate([
            'user_id' => $user->id,
        ], [
            'organization_id' => $ticket->organization_id,
        ]);
    }

    /**
     * @param array<string, mixed> $metadata
     */
    private function recordActivity(
        Ticket $ticket,
        ?User $actor,
        string $event,
        ?string $previousStatus = null,
        ?string $newStatus = null,
        ?string $note = null,
        array $metadata = [],
        string $visibility = 'public',
    ): void {
        $ticket->activities()->create([
            'organization_id' => $ticket->organization_id,
            'actor_id' => $actor?->id,
            'event' => $event,
            'previous_status' => $previousStatus,
            'new_status' => $newStatus,
            'visibility' => $visibility,
            'note' => $note,
            'metadata' => $metadata ?: null,
        ]);
    }
}
