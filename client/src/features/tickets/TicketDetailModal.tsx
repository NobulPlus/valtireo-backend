import { useState } from 'react';
import { Bell, BellOff, Paperclip, Star } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ModalCancelAction } from '@/components/ui/ModalActions';
import { PriorityBadge } from '@/components/ui/PriorityBadge';
import { SelectMenu } from '@/components/ui/SelectMenu';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Textarea } from '@/components/ui/Input';
import { LoadingState } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/context/AuthContext';
import { useActOnApprovalRequest, type ApprovalDecisionAction } from '@/features/approvals/api';
import {
  openTicketAttachmentInNewTab,
  openTicketCommentAttachmentInNewTab,
  slaStatus,
  useAddTicketComment,
  useAssignTicket,
  useCloseTicket,
  useEscalateTicket,
  useHoldTicket,
  useReopenTicket,
  useResolveTicket,
  useResumeTicket,
  useStartTicket,
  useTicket,
  useTicketResolvers,
  useUnwatchTicket,
  useUpdateTicketPriority,
  useWatchTicket,
} from '@/features/tickets/api';
import { ApiError } from '@/lib/apiClient';
import { cn } from '@/lib/cn';
import { useDateFormatter } from '@/lib/dateFormat';
import type { TicketComment } from '@/types/api';

const DECISION_OPTIONS: Array<{ value: ApprovalDecisionAction; label: string }> = [
  { value: 'approve', label: 'Approve' },
  { value: 'reject', label: 'Reject' },
  { value: 'request_changes', label: 'Request changes' },
];

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

const ESCALATION_PRIORITY_OPTIONS = [
  { value: '', label: 'No change' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

const VISIBILITY_OPTIONS = [
  { value: 'public', label: 'Public reply' },
  { value: 'internal', label: 'Internal note' },
];

const ACTIVITY_LABELS: Record<string, string> = {
  ticket_submitted: 'Ticket submitted',
  ticket_assigned: 'Ticket assigned',
  ticket_unassigned: 'Ticket unassigned',
  department_notified: 'Department notified',
  ticket_cancelled: 'Ticket cancelled',
  priority_changed: 'Priority changed',
  work_started: 'Work started',
  ticket_on_hold: 'Placed on hold',
  ticket_resumed: 'Work resumed',
  ticket_escalated: 'Ticket escalated',
  ticket_resolved: 'Ticket resolved',
  ticket_closed: 'Ticket closed',
  ticket_reopened: 'Ticket reopened',
  comment_added: 'Comment added',
  internal_note_added: 'Internal note added',
  watcher_added: 'Started watching',
  watcher_removed: 'Stopped watching',
};

function activityLabel(event: string): string {
  return (
    ACTIVITY_LABELS[event] ??
    event
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  );
}

function actionError(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function SatisfactionStars({
  value,
  onChange,
  readOnly,
}: {
  value: number;
  onChange?: (value: number) => void;
  readOnly?: boolean;
}) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readOnly}
          onClick={() => onChange?.(star)}
          aria-label={`${star} star${star === 1 ? '' : 's'}`}
          className={cn('disabled:cursor-default', !readOnly && 'cursor-pointer')}
        >
          <Star className={cn('h-5 w-5', star <= value ? 'fill-warning text-warning' : 'text-border')} />
        </button>
      ))}
    </div>
  );
}

function CommentCard({ ticketId, comment, formatDateTime }: { ticketId: number; comment: TicketComment; formatDateTime: (value: string | null) => string }) {
  const toast = useToast();

  return (
    <li className={cn('rounded-md border px-3 py-2 text-sm', comment.visibility === 'internal' ? 'border-warning/40 bg-warning-bg/40' : 'border-border')}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 font-medium text-strong">
          {comment.user?.name ?? 'System'}
          {comment.visibility === 'internal' && (
            <span className="rounded-full bg-warning-bg px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-warning">Internal</span>
          )}
        </span>
        <span className="text-xs text-muted">{formatDateTime(comment.created_at)}</span>
      </div>
      <p className="mt-1 whitespace-pre-wrap text-strong">{comment.comment}</p>
      {comment.attachment_download_url && (
        <button
          type="button"
          onClick={() =>
            openTicketCommentAttachmentInNewTab(ticketId, comment).catch((error) =>
              toast.error('Could not open attachment', actionError(error, 'Could not open this attachment.')),
            )
          }
          className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-teal hover:underline"
        >
          <Paperclip className="h-3.5 w-3.5" />
          {comment.attachment_file_name ?? 'View attachment'}
        </button>
      )}
    </li>
  );
}

export function TicketDetailModal({
  ticketId,
  onClose,
  mode,
}: {
  ticketId: number | null;
  onClose: () => void;
  mode: 'view' | 'resolver';
}) {
  const toast = useToast();
  const { session } = useAuth();
  const { formatDateTime } = useDateFormatter();
  const ticketQuery = useTicket(ticketId);
  const resolversQuery = useTicketResolvers(mode === 'resolver');
  const canPostInternalNotes = session?.permissions.includes('service_desk.view') === true;

  const [commentText, setCommentText] = useState('');
  const [commentVisibility, setCommentVisibility] = useState<'public' | 'internal'>('public');
  const [commentAttachment, setCommentAttachment] = useState<File | null>(null);
  const [decisionAction, setDecisionAction] = useState<ApprovalDecisionAction>('approve');
  const [decisionNote, setDecisionNote] = useState('');
  const [startNote, setStartNote] = useState('');
  const [holdReason, setHoldReason] = useState('');
  const [resumeNote, setResumeNote] = useState('');
  const [escalateAssignee, setEscalateAssignee] = useState('');
  const [escalatePriority, setEscalatePriority] = useState('');
  const [escalateNote, setEscalateNote] = useState('');
  const [resolveNote, setResolveNote] = useState('');
  const [reopenReason, setReopenReason] = useState('');
  const [satisfactionRating, setSatisfactionRating] = useState(0);
  const [satisfactionComment, setSatisfactionComment] = useState('');

  const ticket = ticketQuery.data;
  const pendingApproval = ticket?.approval_requests?.find((request) => request.status === 'pending');
  const isWatching = ticket?.watchers?.some((watcher) => watcher.user?.id === session?.user.id) ?? false;

  const addCommentMutation = useAddTicketComment(ticketId ?? 0);
  const assignMutation = useAssignTicket(ticketId ?? 0);
  const priorityMutation = useUpdateTicketPriority(ticketId ?? 0);
  const startMutation = useStartTicket(ticketId ?? 0);
  const holdMutation = useHoldTicket(ticketId ?? 0);
  const resumeMutation = useResumeTicket(ticketId ?? 0);
  const escalateMutation = useEscalateTicket(ticketId ?? 0);
  const resolveMutation = useResolveTicket(ticketId ?? 0);
  const closeMutation = useCloseTicket(ticketId ?? 0);
  const reopenMutation = useReopenTicket(ticketId ?? 0);
  const watchMutation = useWatchTicket(ticketId ?? 0);
  const unwatchMutation = useUnwatchTicket(ticketId ?? 0);
  const decisionMutation = useActOnApprovalRequest(pendingApproval?.id ?? 0);

  async function handleAddComment() {
    if (!commentText.trim()) return;
    try {
      await addCommentMutation.mutateAsync({ comment: commentText.trim(), visibility: commentVisibility, attachment: commentAttachment });
      setCommentText('');
      setCommentVisibility('public');
      setCommentAttachment(null);
    } catch (error) {
      toast.error('Could not add comment', actionError(error, 'Could not add this comment.'));
    }
  }

  async function handleAssign(value: string) {
    try {
      await assignMutation.mutateAsync(value ? Number(value) : null);
      toast.success(value ? 'Ticket assigned' : 'Ticket unassigned');
    } catch (error) {
      toast.error('Could not update assignment', actionError(error, 'Could not update the assignee.'));
    }
  }

  async function handlePriorityChange(value: string) {
    try {
      await priorityMutation.mutateAsync(value);
    } catch (error) {
      toast.error('Could not update priority', actionError(error, 'Could not update the priority.'));
    }
  }

  async function handleDecision() {
    try {
      await decisionMutation.mutateAsync({ action: decisionAction, note: decisionNote.trim() || undefined });
      setDecisionNote('');
      toast.success('Decision recorded');
    } catch (error) {
      toast.error('Could not record decision', actionError(error, 'Could not record this decision.'));
    }
  }

  async function handleStart() {
    try {
      await startMutation.mutateAsync(startNote.trim() || undefined);
      setStartNote('');
      toast.success('Work started');
    } catch (error) {
      toast.error('Could not start work', actionError(error, 'Could not move this ticket into progress.'));
    }
  }

  async function handleHold() {
    if (!holdReason.trim()) return;
    try {
      await holdMutation.mutateAsync(holdReason.trim());
      setHoldReason('');
      toast.success('Ticket placed on hold');
    } catch (error) {
      toast.error('Could not place ticket on hold', actionError(error, 'Could not place this ticket on hold.'));
    }
  }

  async function handleResume() {
    try {
      await resumeMutation.mutateAsync(resumeNote.trim() || undefined);
      setResumeNote('');
      toast.success('Work resumed');
    } catch (error) {
      toast.error('Could not resume ticket', actionError(error, 'Could not resume this ticket.'));
    }
  }

  async function handleEscalate() {
    try {
      await escalateMutation.mutateAsync({
        assigned_to_user_id: escalateAssignee ? Number(escalateAssignee) : undefined,
        priority: escalatePriority || undefined,
        note: escalateNote.trim() || undefined,
      });
      setEscalateAssignee('');
      setEscalatePriority('');
      setEscalateNote('');
      toast.success('Ticket escalated');
    } catch (error) {
      toast.error('Could not escalate ticket', actionError(error, 'Could not escalate this ticket.'));
    }
  }

  async function handleResolve() {
    try {
      await resolveMutation.mutateAsync(resolveNote.trim() || undefined);
      setResolveNote('');
      toast.success('Ticket resolved');
    } catch (error) {
      toast.error('Could not resolve ticket', actionError(error, 'Could not resolve this ticket.'));
    }
  }

  async function handleClose() {
    try {
      await closeMutation.mutateAsync({
        satisfaction_rating: satisfactionRating || undefined,
        satisfaction_comment: satisfactionComment.trim() || undefined,
      });
      setSatisfactionRating(0);
      setSatisfactionComment('');
      toast.success('Ticket closed');
    } catch (error) {
      toast.error('Could not close ticket', actionError(error, 'Could not close this ticket.'));
    }
  }

  async function handleReopen() {
    if (!reopenReason.trim()) return;
    try {
      await reopenMutation.mutateAsync(reopenReason.trim());
      setReopenReason('');
      toast.success('Ticket reopened');
    } catch (error) {
      toast.error('Could not reopen ticket', actionError(error, 'Could not reopen this ticket.'));
    }
  }

  async function handleToggleWatch() {
    try {
      if (isWatching) {
        await unwatchMutation.mutateAsync();
        toast.success('Stopped watching');
      } else {
        await watchMutation.mutateAsync();
        toast.success('Now watching');
      }
    } catch (error) {
      toast.error('Could not update watch status', actionError(error, 'Could not update your watch status.'));
    }
  }

  return (
    <Modal
      open={ticketId !== null}
      onClose={onClose}
      title={ticket?.subject ?? 'Ticket'}
      size="lg"
      footer={<ModalCancelAction title="Close" onClick={onClose} />}
    >
      {ticketQuery.isLoading && <LoadingState label="Loading ticket…" />}
      {ticket && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={ticket.status} />
            <PriorityBadge priority={ticket.priority} />
            {ticket.escalation_level > 0 && (
              <span className="rounded-full bg-danger-bg px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-danger">
                Escalated ×{ticket.escalation_level}
              </span>
            )}
            {ticket.category && (
              <span className="rounded-full bg-teal/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-teal">
                {ticket.category.name}
              </span>
            )}
            {ticket.asset && (
              <span className="rounded-full bg-surface-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
                {ticket.asset.name} ({ticket.asset.asset_tag})
              </span>
            )}
            {ticket.department && (
              <span className="rounded-full bg-surface-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
                {ticket.department.name}
              </span>
            )}
            <span className="text-xs text-muted">{formatDateTime(ticket.submitted_at)}</span>
            {ticket.assigned_to && <span className="text-xs text-muted">· Assigned to {ticket.assigned_to.name}</span>}
            {slaStatus(ticket) && (
              <span className={cn('text-xs font-medium', slaStatus(ticket)?.overdue ? 'text-danger' : 'text-muted')}>
                · {slaStatus(ticket)?.label}
              </span>
            )}
            <button
              type="button"
              onClick={handleToggleWatch}
              disabled={watchMutation.isPending || unwatchMutation.isPending}
              title={isWatching ? 'Stop watching' : 'Watch this ticket'}
              aria-label={isWatching ? 'Stop watching' : 'Watch this ticket'}
              className="ml-auto flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-muted hover:bg-surface-soft hover:text-teal disabled:opacity-50"
            >
              {isWatching ? <Bell className="h-3.5 w-3.5 fill-teal text-teal" /> : <BellOff className="h-3.5 w-3.5" />}
            </button>
          </div>

          <p className="whitespace-pre-wrap text-sm text-strong">{ticket.description}</p>

          {ticket.attachment_download_url && (
            <button
              type="button"
              onClick={() => openTicketAttachmentInNewTab(ticket).catch((error) => toast.error('Could not open attachment', actionError(error, 'Could not open this attachment.')))}
              className="inline-flex items-center gap-1 text-xs font-medium text-teal hover:underline"
            >
              <Paperclip className="h-3.5 w-3.5" />
              {ticket.attachment_file_name ?? 'View attachment'}
            </button>
          )}

          {mode === 'resolver' && (
            <div className="space-y-4 rounded-md border border-border p-3">
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-medium text-muted">Assigned to</span>
                <SelectMenu
                  value={ticket.assigned_to ? String(ticket.assigned_to.id) : ''}
                  onChange={handleAssign}
                  options={[
                    { value: '', label: 'Unassigned' },
                    ...(resolversQuery.data?.data ?? []).map((resolver) => ({ value: String(resolver.id), label: resolver.name })),
                  ]}
                />
              </label>

              <label className="block text-sm">
                <span className="mb-1 block text-xs font-medium text-muted">Priority</span>
                <SelectMenu value={ticket.priority} onChange={handlePriorityChange} options={PRIORITY_OPTIONS} />
              </label>

              {pendingApproval && (
                <div className="space-y-3">
                  <label className="block text-sm">
                    <span className="mb-1 block text-xs font-medium text-muted">Decision</span>
                    <SelectMenu value={decisionAction} onChange={(value) => setDecisionAction(value as ApprovalDecisionAction)} options={DECISION_OPTIONS} />
                  </label>
                  <Textarea
                    value={decisionNote}
                    onChange={(event) => setDecisionNote(event.target.value)}
                    placeholder="Optional — some workflows require a note when rejecting or requesting changes."
                  />
                  <Button type="button" size="sm" isLoading={decisionMutation.isPending} onClick={handleDecision}>
                    Record decision
                  </Button>
                </div>
              )}

              {ticket.status === 'approved' && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted">Start work</p>
                  <Textarea value={startNote} onChange={(event) => setStartNote(event.target.value)} placeholder="Optional note" />
                  <Button type="button" size="sm" isLoading={startMutation.isPending} onClick={handleStart}>
                    Start work
                  </Button>
                </div>
              )}

              {(ticket.status === 'approved' || ticket.status === 'in_progress') && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted">Place on hold</p>
                  <Textarea value={holdReason} onChange={(event) => setHoldReason(event.target.value)} placeholder="Reason for the hold (required)" />
                  <Button type="button" variant="secondary" size="sm" disabled={!holdReason.trim()} isLoading={holdMutation.isPending} onClick={handleHold}>
                    Place on hold
                  </Button>
                </div>
              )}

              {ticket.status === 'on_hold' && (
                <div className="space-y-2">
                  {ticket.hold_reason && <p className="text-xs text-muted">On hold: {ticket.hold_reason}</p>}
                  <Textarea value={resumeNote} onChange={(event) => setResumeNote(event.target.value)} placeholder="Optional note" />
                  <Button type="button" size="sm" isLoading={resumeMutation.isPending} onClick={handleResume}>
                    Resume work
                  </Button>
                </div>
              )}

              {(ticket.status === 'approved' || ticket.status === 'in_progress' || ticket.status === 'on_hold') && (
                <div className="space-y-3 border-t border-border pt-3">
                  <p className="text-xs font-medium text-muted">Escalate</p>
                  <SelectMenu
                    value={escalateAssignee}
                    onChange={setEscalateAssignee}
                    options={[
                      { value: '', label: 'Keep current assignee' },
                      ...(resolversQuery.data?.data ?? []).map((resolver) => ({ value: String(resolver.id), label: resolver.name })),
                    ]}
                  />
                  <SelectMenu value={escalatePriority} onChange={setEscalatePriority} options={ESCALATION_PRIORITY_OPTIONS} />
                  <Textarea value={escalateNote} onChange={(event) => setEscalateNote(event.target.value)} placeholder="Optional note" />
                  <Button type="button" variant="secondary" size="sm" isLoading={escalateMutation.isPending} onClick={handleEscalate}>
                    Escalate
                  </Button>
                </div>
              )}

              {(ticket.status === 'approved' || ticket.status === 'in_progress' || ticket.status === 'on_hold') && (
                <div className="space-y-2 border-t border-border pt-3">
                  <p className="text-xs font-medium text-muted">Resolve</p>
                  <Textarea value={resolveNote} onChange={(event) => setResolveNote(event.target.value)} placeholder="Optional resolution note" />
                  <Button type="button" size="sm" isLoading={resolveMutation.isPending} onClick={handleResolve}>
                    Mark resolved
                  </Button>
                </div>
              )}

              {(ticket.status === 'resolved' || ticket.status === 'closed') && (
                <div className="space-y-2">
                  <Textarea value={reopenReason} onChange={(event) => setReopenReason(event.target.value)} placeholder="Reason for reopening (required)" />
                  <Button type="button" variant="secondary" size="sm" disabled={!reopenReason.trim()} isLoading={reopenMutation.isPending} onClick={handleReopen}>
                    Reopen ticket
                  </Button>
                </div>
              )}
            </div>
          )}

          {ticket.status === 'resolved' && (
            <div className="space-y-3 rounded-md border border-border p-3">
              <p className="text-xs font-medium text-muted">Close this ticket</p>
              <SatisfactionStars value={satisfactionRating} onChange={setSatisfactionRating} />
              <Textarea value={satisfactionComment} onChange={(event) => setSatisfactionComment(event.target.value)} placeholder="Optional feedback" />
              <Button type="button" size="sm" isLoading={closeMutation.isPending} onClick={handleClose}>
                Close ticket
              </Button>
            </div>
          )}

          {ticket.status === 'closed' && ticket.satisfaction_rating && (
            <div className="rounded-md border border-border p-3">
              <p className="mb-1 text-xs font-medium text-muted">Satisfaction rating</p>
              <SatisfactionStars value={ticket.satisfaction_rating} readOnly />
              {ticket.satisfaction_comment && <p className="mt-2 whitespace-pre-wrap text-sm text-strong">{ticket.satisfaction_comment}</p>}
            </div>
          )}

          {ticket.watchers && ticket.watchers.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium text-muted">Watchers</p>
              <p className="text-sm text-strong">{ticket.watchers.map((watcher) => watcher.user?.name).filter(Boolean).join(', ')}</p>
            </div>
          )}

          <div>
            <p className="mb-2 text-xs font-medium text-muted">Comments</p>
            {ticket.comments && ticket.comments.length > 0 ? (
              <ul className="space-y-2">
                {ticket.comments.map((comment) => (
                  <CommentCard key={comment.id} ticketId={ticket.id} comment={comment} formatDateTime={formatDateTime} />
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">No comments yet.</p>
            )}

            <div className="mt-3 space-y-2">
              <Textarea value={commentText} onChange={(event) => setCommentText(event.target.value)} placeholder="Add a comment…" />
              <div className="flex flex-wrap items-center gap-2">
                {canPostInternalNotes && (
                  <SelectMenu
                    className="w-40"
                    value={commentVisibility}
                    onChange={(value) => setCommentVisibility(value as 'public' | 'internal')}
                    options={VISIBILITY_OPTIONS}
                  />
                )}
                <input
                  type="file"
                  onChange={(event) => setCommentAttachment(event.target.files?.[0] ?? null)}
                  className="flex-1 text-xs text-muted file:mr-2 file:rounded-md file:border file:border-border file:bg-surface file:px-2 file:py-1 file:text-xs file:font-medium file:text-strong"
                />
              </div>
              <div className="flex justify-end">
                <Button type="button" size="sm" isLoading={addCommentMutation.isPending} disabled={!commentText.trim()} onClick={handleAddComment}>
                  Add comment
                </Button>
              </div>
            </div>
          </div>

          {ticket.activities && ticket.activities.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium text-muted">Activity</p>
              <ul className="space-y-2">
                {[...ticket.activities].reverse().map((activity) => (
                  <li key={activity.id} className="rounded-md border border-border px-3 py-2 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-strong">{activityLabel(activity.event)}</span>
                      <span className="text-xs text-muted">{formatDateTime(activity.created_at)}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted">{activity.actor?.name ?? 'System'}</p>
                    {activity.note && <p className="mt-1 whitespace-pre-wrap text-strong">{activity.note}</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
