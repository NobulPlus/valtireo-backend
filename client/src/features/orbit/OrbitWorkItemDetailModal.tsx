import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Ban, Eye, EyeOff, Link2, Package, PackageCheck, Paperclip, Reply, Trash2, X } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { ModalCancelAction, ModalConfirmAction } from '@/components/ui/ModalActions';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Input, Textarea } from '@/components/ui/Input';
import { SelectMenu } from '@/components/ui/SelectMenu';
import { DatePicker } from '@/components/ui/DatePicker';
import { OptionDot } from '@/components/ui/OptionDot';
import { PriorityBadge } from '@/components/ui/PriorityBadge';
import { LoadingState } from '@/components/ui/States';
import { useAuth } from '@/context/AuthContext';
import { useDateFormatter } from '@/lib/dateFormat';
import { cn } from '@/lib/cn';
import {
  ORBIT_LINK_TYPES,
  openOrbitAttachment,
  useCreateOrbitComment,
  useCreateOrbitWorkItemLink,
  useDeleteOrbitAttachment,
  useDeleteOrbitWorkItemLink,
  useOrbitComments,
  useOrbitIterations,
  useOrbitLabels,
  useOrbitProject,
  useOrbitProjectMembers,
  useOrbitWorkItem,
  useOrbitWorkItemLinks,
  useOrbitWorkItems,
  useSetAttachmentDeliverable,
  useSetWorkItemBlocked,
  useUnwatchOrbitWorkItem,
  useUpdateOrbitWorkItem,
  useUploadOrbitWorkItemAttachment,
  useWatchOrbitWorkItem,
  type OrbitComment,
  type OrbitStatus,
  type OrbitWorkItem,
} from '@/features/orbit/api';
import { ApiError } from '@/lib/apiClient';

// Categorical, not severity — same chart-palette treatment as OrbitProjectBoardPage's
// item-type dots, extended with the palette's tinted pair for the extra two link types.
const LINK_TYPE_DOT: Record<string, string> = {
  ticket: 'bg-chart-1',
  asset: 'bg-chart-2',
  document: 'bg-chart-3',
  leave_request: 'bg-chart-4',
  operation_task: 'bg-chart-5',
};

const LINK_TYPE_OPTIONS = ORBIT_LINK_TYPES.map((type) => ({
  ...type,
  icon: <OptionDot className={LINK_TYPE_DOT[type.value] ?? 'bg-chart-6'} />,
}));

// Severity — reuses PriorityBadge's exact tone mapping (low: draft, medium: info, high: warning, urgent: danger),
// matching OrbitProjectBoardPage's own PRIORITIES constant.
const PRIORITIES = [
  { value: 'low', label: 'Low', icon: <OptionDot className="bg-draft" /> },
  { value: 'medium', label: 'Medium', icon: <OptionDot className="bg-info" /> },
  { value: 'high', label: 'High', icon: <OptionDot className="bg-warning" /> },
  { value: 'urgent', label: 'Urgent', icon: <OptionDot className="bg-danger" /> },
];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function toDateInput(value: string | null): string {
  return value ? value.slice(0, 10) : '';
}

export function OrbitWorkItemDetailModal({
  itemKey,
  projectId,
  statuses,
  onChangeStatus,
  onClose,
}: {
  itemKey: string;
  projectId: number;
  statuses: OrbitStatus[];
  onChangeStatus: (item: OrbitWorkItem, statusId: number) => void;
  onClose: () => void;
}) {
  const { session } = useAuth();
  const { formatDateTime } = useDateFormatter();
  const { data, isLoading } = useOrbitWorkItem(itemKey);
  const { data: projectData } = useOrbitProject(projectId);
  const { data: commentsData } = useOrbitComments(itemKey);
  const { data: linksData } = useOrbitWorkItemLinks(itemKey);
  const { data: membersData } = useOrbitProjectMembers(projectId);
  const { data: iterationsData } = useOrbitIterations(projectId, projectData?.project.mode === 'scrum');
  const { data: workItemsData } = useOrbitWorkItems(projectId);
  const { data: labelsData } = useOrbitLabels(projectId);
  const updateWorkItem = useUpdateOrbitWorkItem(projectId);
  const createComment = useCreateOrbitComment(itemKey);
  const uploadAttachment = useUploadOrbitWorkItemAttachment(itemKey);
  const deleteAttachment = useDeleteOrbitAttachment(itemKey);
  const setDeliverable = useSetAttachmentDeliverable(itemKey);
  const createLink = useCreateOrbitWorkItemLink(itemKey);
  const deleteLink = useDeleteOrbitWorkItemLink(itemKey);
  const watchItem = useWatchOrbitWorkItem(itemKey);
  const unwatchItem = useUnwatchOrbitWorkItem(itemKey);
  const setBlocked = useSetWorkItemBlocked(projectId);

  const [body, setBody] = useState('');
  const [mentions, setMentions] = useState<Map<number, string>>(new Map());
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<{ id: number; authorName: string; snippet: string } | null>(null);
  const [linkType, setLinkType] = useState(ORBIT_LINK_TYPES[0].value);
  const [linkId, setLinkId] = useState('');
  const [linkError, setLinkError] = useState<string | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [sprintError, setSprintError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [blockPromptOpen, setBlockPromptOpen] = useState(false);
  const [blockReason, setBlockReason] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [titleDraft, setTitleDraft] = useState('');
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [acceptanceDraft, setAcceptanceDraft] = useState('');
  const [definitionDraft, setDefinitionDraft] = useState('');
  const [estimateDraft, setEstimateDraft] = useState('');
  const [remainingEstimateDraft, setRemainingEstimateDraft] = useState('');

  const item = data?.work_item;
  const project = projectData?.project;
  const comments = commentsData?.data ?? [];
  const links = linksData?.data ?? [];
  const members = membersData?.data ?? [];
  const iterations = iterationsData?.data ?? [];
  const allWorkItems = workItemsData?.data ?? [];
  const projectLabels = labelsData?.data ?? [];
  const canEdit = Boolean(project?.can_edit_work_items);
  const commentError = createComment.error instanceof ApiError ? createComment.error.message : null;
  const isWatching = Boolean(item?.watchers?.some((watcher) => watcher.id === session?.user.id));

  useEffect(() => {
    if (!item) return;
    setTitleDraft(item.title);
    setDescriptionDraft(item.description ?? '');
    setAcceptanceDraft(item.acceptance_criteria ?? '');
    setDefinitionDraft(item.definition_of_done ?? '');
    setEstimateDraft(item.estimate != null ? String(item.estimate) : '');
    setRemainingEstimateDraft(item.remaining_estimate != null ? String(item.remaining_estimate) : '');
    // Only re-sync drafts when switching to a different item, not on every refetch of the same one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id]);

  async function saveField(payload: Record<string, unknown>) {
    if (!item) return;
    setFieldError(null);
    try {
      await updateWorkItem.mutateAsync({ key: item.key, version: item.version, ...payload });
    } catch (err) {
      setFieldError(err instanceof ApiError ? err.message : 'Could not save that change.');
    }
  }

  function handleTitleBlur() {
    if (!item) return;
    const trimmed = titleDraft.trim();
    if (trimmed && trimmed !== item.title) void saveField({ title: trimmed });
  }

  function handleDescriptionBlur() {
    if (!item) return;
    if (descriptionDraft !== (item.description ?? '')) void saveField({ description: descriptionDraft || null });
  }

  function handleAcceptanceBlur() {
    if (!item) return;
    if (acceptanceDraft !== (item.acceptance_criteria ?? '')) void saveField({ acceptance_criteria: acceptanceDraft || null });
  }

  function handleDefinitionBlur() {
    if (!item) return;
    if (definitionDraft !== (item.definition_of_done ?? '')) void saveField({ definition_of_done: definitionDraft || null });
  }

  function handleEstimateBlur() {
    if (!item) return;
    const parsed = estimateDraft.trim() === '' ? null : Number(estimateDraft);
    if (parsed !== (item.estimate ?? null)) void saveField({ estimate: parsed });
  }

  function handleRemainingEstimateBlur() {
    if (!item) return;
    const parsed = remainingEstimateDraft.trim() === '' ? null : Number(remainingEstimateDraft);
    if (parsed !== (item.remaining_estimate ?? null)) void saveField({ remaining_estimate: parsed });
  }

  function handlePriorityChange(value: string) {
    void saveField({ priority: value });
  }

  function handleAssigneeChange(value: string) {
    void saveField({ assignee_id: value === 'unassigned' ? null : Number(value) });
  }

  function handleEpicChange(value: string) {
    void saveField({ epic_id: value === 'none' ? null : Number(value) });
  }

  function handleDueDateChange(value: string) {
    void saveField({ due_at: value || null });
  }

  function handleStartDateChange(value: string) {
    void saveField({ start_at: value || null });
  }

  function handleStatusChange(value: string) {
    if (item) onChangeStatus(item, Number(value));
  }

  function handleToggleLabel(labelId: number) {
    if (!item) return;
    const current = new Set((item.labels ?? []).map((label) => label.id));
    if (current.has(labelId)) current.delete(labelId);
    else current.add(labelId);
    void saveField({ label_ids: Array.from(current) });
  }

  async function handleToggleWatch() {
    if (!item) return;
    setFieldError(null);
    try {
      if (isWatching) await unwatchItem.mutateAsync();
      else await watchItem.mutateAsync();
    } catch (err) {
      setFieldError(err instanceof ApiError ? err.message : 'Could not update watch status.');
    }
  }

  async function handleBlock() {
    if (!item) return;
    setFieldError(null);
    try {
      await setBlocked.mutateAsync({ key: item.key, is_blocked: true, blocked_reason: blockReason || null });
      setBlockPromptOpen(false);
      setBlockReason('');
    } catch (err) {
      setFieldError(err instanceof ApiError ? err.message : 'Could not block this item.');
    }
  }

  async function handleUnblock() {
    if (!item) return;
    setFieldError(null);
    try {
      await setBlocked.mutateAsync({ key: item.key, is_blocked: false });
    } catch (err) {
      setFieldError(err instanceof ApiError ? err.message : 'Could not unblock this item.');
    }
  }

  async function handleSprintChange(value: string) {
    if (!item) return;
    setSprintError(null);
    try {
      await updateWorkItem.mutateAsync({ key: item.key, version: item.version, iteration_id: value === 'backlog' ? null : Number(value) });
    } catch (err) {
      setSprintError(err instanceof ApiError ? err.message : 'Could not update the sprint.');
    }
  }

  const mentionCandidates = useMemo(() => {
    if (mentionQuery === null) return [];
    const query = mentionQuery.toLowerCase();
    return members.filter((member) => member.id !== session?.user.id && member.name.toLowerCase().includes(query)).slice(0, 6);
  }, [mentionQuery, members, session?.user.id]);

  const assigneeOptions = useMemo(
    () => [{ value: 'unassigned', label: 'Unassigned' }, ...members.map((member) => ({ value: String(member.id), label: member.name }))],
    [members],
  );

  const statusOptions = useMemo(() => statuses.map((status) => ({ value: String(status.id), label: status.name })), [statuses]);

  const epicOptions = useMemo(
    () => [
      { value: 'none', label: 'No epic' },
      ...allWorkItems
        .filter((candidate) => candidate.type === 'epic' && candidate.id !== item?.id)
        .map((epic) => ({ value: String(epic.id), label: `${epic.key} ${epic.title}` })),
    ],
    [allWorkItems, item?.id],
  );

  function handleBodyChange(event: ChangeEvent<HTMLTextAreaElement>) {
    const value = event.target.value;
    setBody(value);

    const cursor = event.target.selectionStart ?? value.length;
    const upToCursor = value.slice(0, cursor);
    const at = upToCursor.lastIndexOf('@');

    if (at === -1) {
      setMentionQuery(null);
      return;
    }

    const token = upToCursor.slice(at + 1);
    if (token.includes(' ') || token.includes('\n')) {
      setMentionQuery(null);
      return;
    }

    setMentionQuery(token);
  }

  function selectMention(memberId: number, name: string) {
    const at = body.lastIndexOf('@');
    if (at === -1) return;
    setBody(`${body.slice(0, at)}@${name} `);
    setMentions((prev) => new Map(prev).set(memberId, name));
    setMentionQuery(null);
  }

  function handleReplyTo(comment: OrbitComment) {
    setReplyingTo({ id: comment.id, authorName: comment.author?.name ?? 'Someone', snippet: comment.body.slice(0, 60) });
  }

  async function handleComment(event: FormEvent) {
    event.preventDefault();
    if (!body.trim()) return;
    await createComment.mutateAsync({ body, mentions: Array.from(mentions.keys()), reply_to_id: replyingTo?.id ?? null });
    setBody('');
    setMentions(new Map());
    setMentionQuery(null);
    setReplyingTo(null);
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setAttachmentError(null);
    try {
      await uploadAttachment.mutateAsync(file);
    } catch (err) {
      setAttachmentError(err instanceof ApiError ? err.message : 'Could not upload that file.');
    }
  }

  async function handleRemoveAttachment(attachmentId: number) {
    setAttachmentError(null);
    try {
      await deleteAttachment.mutateAsync(attachmentId);
    } catch (err) {
      setAttachmentError(err instanceof ApiError ? err.message : 'Could not remove that attachment.');
    }
  }

  async function handleAddLink(event: FormEvent) {
    event.preventDefault();
    const numericId = Number(linkId);
    if (!numericId) return;
    setLinkError(null);
    try {
      await createLink.mutateAsync({ linked_type: linkType, linked_id: numericId });
      setLinkId('');
    } catch (err) {
      setLinkError(err instanceof ApiError ? err.message : 'Could not add that link.');
    }
  }

  async function handleRemoveLink(linkId: number) {
    setLinkError(null);
    try {
      await deleteLink.mutateAsync(linkId);
    } catch (err) {
      setLinkError(err instanceof ApiError ? err.message : 'Could not remove that link.');
    }
  }

  return (
    <Modal open onClose={onClose} title={item ? `${item.key} · ${item.title}` : 'Loading…'} size="lg">
      {isLoading || !item ? (
        <LoadingState fill />
      ) : (
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <PriorityBadge priority={item.priority} />
              <span className="text-xs capitalize text-muted">{item.type}</span>
              {!canEdit && item.status && <span className="text-xs text-muted">· {item.status.name}</span>}
              {!canEdit && item.assignee && <span className="text-xs text-muted">· Assigned to {item.assignee.name}</span>}
              {(item.watchers?.length ?? 0) > 0 && (
                <span className="text-xs text-muted">· {item.watchers!.length} watching</span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {canEdit && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={item.is_blocked ? 'Unblock this item' : 'Block this item'}
                  title={item.is_blocked ? 'Unblock' : 'Block'}
                  onClick={() => (item.is_blocked ? void handleUnblock() : setBlockPromptOpen(true))}
                  isLoading={setBlocked.isPending}
                >
                  <Ban className={cn('h-3.5 w-3.5', item.is_blocked && 'text-danger')} />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                aria-label={isWatching ? 'Stop watching this item' : 'Watch this item'}
                onClick={() => void handleToggleWatch()}
                isLoading={watchItem.isPending || unwatchItem.isPending}
              >
                {isWatching ? <Eye className="h-3.5 w-3.5 text-pine" /> : <EyeOff className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>

          {blockPromptOpen && (
            <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface-soft p-3">
              <Field label="Block reason" hint="Optional">
                <Textarea value={blockReason} onChange={(event) => setBlockReason(event.target.value)} rows={2} />
              </Field>
              <div className="flex justify-end gap-2">
                <ModalCancelAction onClick={() => setBlockPromptOpen(false)} />
                <ModalConfirmAction title="Mark blocked" onClick={() => void handleBlock()} isLoading={setBlocked.isPending} />
              </div>
            </div>
          )}

          {item.is_blocked && (
            <div className="rounded-lg border border-border bg-surface-soft px-3 py-2 text-xs text-muted">
              <p className="font-medium text-danger">Blocked</p>
              {item.blocked_reason && <p className="mt-1 whitespace-pre-wrap text-strong">{item.blocked_reason}</p>}
            </div>
          )}

          {fieldError && <p className="text-sm text-danger">{fieldError}</p>}

          {project?.mode === 'scrum' && (
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-muted">Sprint</span>
              <SelectMenu
                value={item.iteration_id ? String(item.iteration_id) : 'backlog'}
                onChange={handleSprintChange}
                disabled={!canEdit || updateWorkItem.isPending}
                className="w-56"
                options={[
                  { value: 'backlog', label: 'Backlog' },
                  ...iterations
                    .filter((iteration) => iteration.status !== 'completed' || iteration.id === item.iteration_id)
                    .map((iteration) => ({
                      value: String(iteration.id),
                      label: iteration.status === 'completed' ? `${iteration.name} (completed)` : iteration.name,
                    })),
                ]}
              />
              {sprintError && <p className="text-xs text-danger">{sprintError}</p>}
            </div>
          )}

          {item.status?.category === 'done' && (item.completed_by || item.completion_note) && (
            <div className="rounded-lg border border-border bg-surface-soft px-3 py-2 text-xs text-muted">
              {item.completed_by && (
                <p>
                  Completed by <span className="font-medium text-strong">{item.completed_by.name}</span>
                  {item.completed_at ? ` · ${formatDateTime(item.completed_at)}` : ''}
                </p>
              )}
              {item.completion_note && <p className="mt-1 whitespace-pre-wrap text-strong">{item.completion_note}</p>}
            </div>
          )}

          {canEdit ? (
            <div className="flex flex-col gap-4">
              <Field label="Title">
                <Input value={titleDraft} onChange={(event) => setTitleDraft(event.target.value)} onBlur={handleTitleBlur} />
              </Field>
              <Field label="Description">
                <Textarea value={descriptionDraft} onChange={(event) => setDescriptionDraft(event.target.value)} onBlur={handleDescriptionBlur} rows={3} />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Priority">
                  <SelectMenu value={item.priority} onChange={handlePriorityChange} options={PRIORITIES} disabled={updateWorkItem.isPending} />
                </Field>
                <Field label="Status">
                  <SelectMenu value={String(item.status_id)} onChange={handleStatusChange} options={statusOptions} />
                </Field>
                <Field label="Assignee">
                  <SelectMenu
                    value={item.assignee_id ? String(item.assignee_id) : 'unassigned'}
                    onChange={handleAssigneeChange}
                    options={assigneeOptions}
                    disabled={updateWorkItem.isPending}
                  />
                </Field>
                <Field label="Due date">
                  <DatePicker value={toDateInput(item.due_at)} onChange={handleDueDateChange} />
                </Field>
                {project?.mode === 'scrum' && (
                  <>
                    <Field label="Start date">
                      <DatePicker value={toDateInput(item.start_at)} onChange={handleStartDateChange} />
                    </Field>
                    <Field label="Epic">
                      <SelectMenu
                        value={item.epic_id ? String(item.epic_id) : 'none'}
                        onChange={handleEpicChange}
                        options={epicOptions}
                        disabled={updateWorkItem.isPending}
                      />
                    </Field>
                    <Field label="Estimate">
                      <Input
                        value={estimateDraft}
                        onChange={(event) => setEstimateDraft(event.target.value.replace(/[^0-9.]/g, ''))}
                        onBlur={handleEstimateBlur}
                        placeholder="Story points or hours"
                      />
                    </Field>
                    <Field label="Remaining estimate">
                      <Input
                        value={remainingEstimateDraft}
                        onChange={(event) => setRemainingEstimateDraft(event.target.value.replace(/[^0-9.]/g, ''))}
                        onBlur={handleRemainingEstimateBlur}
                      />
                    </Field>
                  </>
                )}
              </div>
              <Field label="Acceptance criteria">
                <Textarea value={acceptanceDraft} onChange={(event) => setAcceptanceDraft(event.target.value)} onBlur={handleAcceptanceBlur} rows={2} />
              </Field>
              {project?.mode === 'scrum' && (
                <Field label="Definition of done">
                  <Textarea value={definitionDraft} onChange={(event) => setDefinitionDraft(event.target.value)} onBlur={handleDefinitionBlur} rows={2} />
                </Field>
              )}
            </div>
          ) : (
            <>
              {item.description && <p className="text-sm text-strong whitespace-pre-wrap">{item.description}</p>}
              {item.acceptance_criteria && (
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Acceptance criteria</p>
                  <p className="text-sm text-strong whitespace-pre-wrap">{item.acceptance_criteria}</p>
                </div>
              )}
              {item.definition_of_done && (
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Definition of done</p>
                  <p className="text-sm text-strong whitespace-pre-wrap">{item.definition_of_done}</p>
                </div>
              )}
            </>
          )}

          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Labels</p>
            <div className="flex flex-wrap gap-1.5">
              {canEdit ? (
                projectLabels.length > 0 ? (
                  projectLabels.map((label) => {
                    const active = (item.labels ?? []).some((candidate) => candidate.id === label.id);
                    return (
                      <button
                        key={label.id}
                        type="button"
                        onClick={() => handleToggleLabel(label.id)}
                        className={cn(
                          'rounded-full px-2 py-0.5 text-xs font-medium transition',
                          active ? 'text-white' : 'border border-border text-muted hover:text-strong',
                        )}
                        style={active ? { backgroundColor: label.color } : undefined}
                      >
                        {label.name}
                      </button>
                    );
                  })
                ) : (
                  <p className="text-sm text-muted">No labels on this project yet.</p>
                )
              ) : (item.labels ?? []).length > 0 ? (
                item.labels!.map((label) => (
                  <span key={label.id} className="rounded-full px-2 py-0.5 text-xs font-medium text-white" style={{ backgroundColor: label.color }}>
                    {label.name}
                  </span>
                ))
              ) : (
                <p className="text-sm text-muted">No labels.</p>
              )}
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Attachments</p>
              {canEdit && (
                <>
                  <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />
                  <Button variant="ghost" size="icon" aria-label="Attach a file" onClick={() => fileInputRef.current?.click()} isLoading={uploadAttachment.isPending}>
                    <Paperclip className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
            </div>
            {attachmentError && <p className="mb-2 text-sm text-danger">{attachmentError}</p>}
            <ul className="flex flex-col gap-1">
              {(item.attachments ?? []).map((attachment) => (
                <li key={attachment.id} className="flex items-center justify-between gap-2 rounded-md bg-surface-soft px-3 py-2">
                  <button
                    type="button"
                    onClick={() => void openOrbitAttachment(attachment)}
                    className="min-w-0 truncate text-left text-sm text-pine hover:underline"
                  >
                    {attachment.file_name}
                  </button>
                  <div className="flex flex-shrink-0 items-center gap-2">
                    <span className="text-xs text-muted">{formatFileSize(attachment.file_size)}</span>
                    {canEdit && project?.mode === 'scrum' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={attachment.is_deliverable ? `Unmark ${attachment.file_name} as deliverable` : `Mark ${attachment.file_name} as deliverable`}
                        title={attachment.is_deliverable ? 'Unmark as deliverable' : 'Mark as deliverable'}
                        onClick={() => void setDeliverable.mutateAsync({ attachmentId: attachment.id, is_deliverable: !attachment.is_deliverable })}
                        isLoading={setDeliverable.isPending}
                      >
                        {attachment.is_deliverable ? <PackageCheck className="h-3.5 w-3.5 text-pine" /> : <Package className="h-3.5 w-3.5 text-muted" />}
                      </Button>
                    )}
                    {(attachment.uploaded_by_id === session?.user.id || project?.can_administer) && (
                      <Button variant="ghost" size="icon" aria-label={`Remove ${attachment.file_name}`} onClick={() => void handleRemoveAttachment(attachment.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-danger" />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
              {(item.attachments ?? []).length === 0 && <li className="text-sm text-muted">No attachments.</li>}
            </ul>
          </div>

          <div className="border-t border-border pt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Linked records</p>
            {linkError && <p className="mb-2 text-sm text-danger">{linkError}</p>}
            <ul className="flex flex-col gap-1">
              {links.map((link) => (
                <li key={link.id} className="flex items-center justify-between gap-2 rounded-md bg-surface-soft px-3 py-2">
                  <span className="min-w-0 truncate text-sm">
                    {link.viewer_can_access ? (
                      link.url ? (
                        <a href={link.url} className="text-teal hover:underline">{link.label}</a>
                      ) : (
                        <span className="text-strong">{link.label}</span>
                      )
                    ) : (
                      <span className="text-muted">Linked record unavailable</span>
                    )}
                  </span>
                  {canEdit && (
                    <Button variant="ghost" size="icon" aria-label="Remove link" onClick={() => void handleRemoveLink(link.id)}>
                      <X className="h-3.5 w-3.5 text-danger" />
                    </Button>
                  )}
                </li>
              ))}
              {links.length === 0 && <li className="text-sm text-muted">No linked records.</li>}
            </ul>

            {canEdit && (
              <form onSubmit={handleAddLink} className="mt-3 flex items-center gap-2">
                <SelectMenu value={linkType} onChange={setLinkType} options={LINK_TYPE_OPTIONS} className="w-44" />
                <Input
                  value={linkId}
                  onChange={(event) => setLinkId(event.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="Record ID"
                  className="w-28"
                />
                <Button type="submit" variant="secondary" size="icon" aria-label="Add link" disabled={!linkId} isLoading={createLink.isPending}>
                  <Link2 className="h-3.5 w-3.5" />
                </Button>
              </form>
            )}
          </div>

          <div className="border-t border-border pt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Comments</p>
            <ul className="flex flex-col gap-3">
              {comments.map((comment) => (
                <li key={comment.id} className="rounded-md bg-surface-soft p-3">
                  {comment.reply_to && (
                    <p className="mb-1 truncate text-xs text-muted">↳ Replying to "{comment.reply_to.body.slice(0, 60)}"</p>
                  )}
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-medium text-strong">{comment.author?.name}</p>
                    {canEdit && (
                      <Button variant="ghost" size="icon" aria-label="Reply to this comment" onClick={() => handleReplyTo(comment)}>
                        <Reply className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  <p className="text-sm text-strong whitespace-pre-wrap">{comment.body}</p>
                </li>
              ))}
              {comments.length === 0 && <li className="text-sm text-muted">No comments yet.</li>}
            </ul>

            {canEdit && (
              <form onSubmit={handleComment} className="mt-3 flex flex-col gap-2">
                {commentError && <p className="text-sm text-danger">{commentError}</p>}
                {replyingTo && (
                  <div className="flex items-center justify-between gap-2 rounded-md bg-surface-soft px-3 py-1.5 text-xs text-muted">
                    <span className="min-w-0 truncate">Replying to {replyingTo.authorName}: "{replyingTo.snippet}…"</span>
                    <Button type="button" variant="ghost" size="icon" aria-label="Cancel reply" onClick={() => setReplyingTo(null)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}
                <div className="relative">
                  <Textarea
                    value={body}
                    onChange={handleBodyChange}
                    rows={2}
                    placeholder="Add a comment… use @ to mention a project member"
                  />
                  {mentionQuery !== null && mentionCandidates.length > 0 && (
                    <ul className="absolute left-0 top-full z-10 mt-1 w-56 rounded-md border border-border bg-surface shadow-md">
                      {mentionCandidates.map((member) => (
                        <li key={member.id}>
                          <button
                            type="button"
                            onClick={() => selectMention(member.id, member.name)}
                            className="block w-full px-3 py-1.5 text-left text-sm text-strong hover:bg-surface-soft"
                          >
                            {member.name}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="flex justify-end">
                  <Button type="submit" variant="primary" size="sm" isLoading={createComment.isPending} disabled={!body.trim()}>
                    Comment
                  </Button>
                </div>
              </form>
            )}
          </div>

          {(item.activities?.length ?? 0) > 0 && (
            <div className="border-t border-border pt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Activity</p>
              <ul className="flex flex-col gap-2">
                {item.activities!.map((activity) => (
                  <li key={activity.id} className="rounded-md border border-border px-3 py-2 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-strong">{activity.title}</span>
                      <span className="flex-shrink-0 text-xs text-muted">{formatDateTime(activity.created_at)}</span>
                    </div>
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
