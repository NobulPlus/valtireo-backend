<?php

namespace App\Services;

use App\Models\Department;
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
    private const TERMINAL_STATUSES = ['cancelled', 'rejected', 'closed'];
    private const WORKABLE_STATUSES = ['approved', 'in_progress', 'on_hold'];

    public function __construct(
        private readonly ApprovalRequestService $approvals,
        private readonly NotificationDispatchService $notifications,
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
                    'status' => 'submitted',
                    'priority' => $data['priority'] ?? 'medium',
                    'assigned_to_user_id' => $assignee?->id,
                    'attachment_file_name' => $attachment instanceof UploadedFile ? $attachment->getClientOriginalName() : null,
                    'attachment_file_path' => $attachmentPath,
                    'attachment_mime_type' => $attachment instanceof UploadedFile ? $attachment->getClientMimeType() : null,
                    'attachment_file_size' => $attachment instanceof UploadedFile ? $attachment->getSize() : null,
                    'submitted_at' => $submittedAt,
                    'sla_due_at' => $category->resolution_sla_hours
                        ? $submittedAt->clone()->addHours($category->resolution_sla_hours)
                        : null,
                ]);

                $this->recordActivity($ticket, $actor, 'ticket_submitted', null, 'submitted', null, [
                    'ticket_category_id' => $category->id,
                    'priority' => $ticket->priority,
                    'has_attachment' => $attachmentPath !== null,
                ]);

                $this->ensureWatcher($ticket, $actor);

                $this->approvals->submit(
                    $actor,
                    $ticket,
                    'service_desk',
                    strtolower($category->code),
                    "Review {$employee->first_name} {$employee->last_name}'s {$category->name} ticket: {$data['subject']}",
                    $employee,
                    [
                        'ticket_category_id' => $category->id,
                        'has_attachment' => $attachmentPath !== null,
                    ]
                );

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

        if (! in_array($ticket->status, ['submitted', 'changes_requested'], true)) {
            throw ValidationException::withMessages([
                'status' => ['Only a submitted or change-requested ticket can be cancelled.'],
            ]);
        }

        return DB::transaction(function () use ($actor, $ticket): Ticket {
            $previousStatus = $ticket->status;
            $ticket->update([
                'status' => 'cancelled',
                'reviewed_at' => now(),
            ]);

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
            $ticket->update([
                'status' => 'in_progress',
                'on_hold_at' => null,
                'hold_reason' => null,
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

        if (! $actor->can('service_desk.view') && $actor->employee?->id !== $ticket->employee_id) {
            abort(403);
        }
    }

    private function assertResolverCanWork(User $actor, Ticket $ticket): void
    {
        if ($ticket->organization_id !== $actor->organization_id) {
            abort(404);
        }

        if (! $actor->is_platform_admin && ! $actor->can('organizations.administer') && ! $actor->can('service_desk.view') && $actor->id !== $ticket->assigned_to_user_id) {
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

        if (! $resolver || $resolver->organization_id !== $organizationId || ! $resolver->can('service_desk.view')) {
            throw ValidationException::withMessages([
                'assigned_to_user_id' => ['The selected user must belong to this organization and hold service desk access.'],
            ]);
        }

        return $resolver;
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
