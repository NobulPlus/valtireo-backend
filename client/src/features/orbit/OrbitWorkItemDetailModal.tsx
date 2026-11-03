import { useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link2, Paperclip, Trash2, X } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { SelectMenu } from '@/components/ui/SelectMenu';
import { PriorityBadge } from '@/components/ui/PriorityBadge';
import { LoadingState } from '@/components/ui/States';
import { useAuth } from '@/context/AuthContext';
import {
  ORBIT_LINK_TYPES,
  openOrbitAttachment,
  useCreateOrbitComment,
  useCreateOrbitWorkItemLink,
  useDeleteOrbitAttachment,
  useDeleteOrbitWorkItemLink,
  useOrbitComments,
  useOrbitProject,
  useOrbitProjectMembers,
  useOrbitWorkItem,
  useOrbitWorkItemLinks,
  useUploadOrbitWorkItemAttachment,
} from '@/features/orbit/api';
import { ApiError } from '@/lib/apiClient';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function OrbitWorkItemDetailModal({
  itemKey,
  projectId,
  onClose,
}: {
  itemKey: string;
  projectId: number;
  onClose: () => void;
}) {
  const { session } = useAuth();
  const { data, isLoading } = useOrbitWorkItem(itemKey);
  const { data: projectData } = useOrbitProject(projectId);
  const { data: commentsData } = useOrbitComments(itemKey);
  const { data: linksData } = useOrbitWorkItemLinks(itemKey);
  const { data: membersData } = useOrbitProjectMembers(projectId);
  const createComment = useCreateOrbitComment(itemKey);
  const uploadAttachment = useUploadOrbitWorkItemAttachment(itemKey);
  const deleteAttachment = useDeleteOrbitAttachment(itemKey);
  const createLink = useCreateOrbitWorkItemLink(itemKey);
  const deleteLink = useDeleteOrbitWorkItemLink(itemKey);

  const [body, setBody] = useState('');
  const [mentions, setMentions] = useState<Map<number, string>>(new Map());
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [linkType, setLinkType] = useState(ORBIT_LINK_TYPES[0].value);
  const [linkId, setLinkId] = useState('');
  const [linkError, setLinkError] = useState<string | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const item = data?.work_item;
  const project = projectData?.project;
  const comments = commentsData?.data ?? [];
  const links = linksData?.data ?? [];
  const members = membersData?.data ?? [];
  const canEdit = Boolean(project?.can_edit_work_items);
  const commentError = createComment.error instanceof ApiError ? createComment.error.message : null;

  const mentionCandidates = useMemo(() => {
    if (mentionQuery === null) return [];
    const query = mentionQuery.toLowerCase();
    return members.filter((member) => member.id !== session?.user.id && member.name.toLowerCase().includes(query)).slice(0, 6);
  }, [mentionQuery, members, session?.user.id]);

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

  async function handleComment(event: FormEvent) {
    event.preventDefault();
    if (!body.trim()) return;
    await createComment.mutateAsync({ body, mentions: Array.from(mentions.keys()) });
    setBody('');
    setMentions(new Map());
    setMentionQuery(null);
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
          <div className="flex flex-wrap items-center gap-3">
            <PriorityBadge priority={item.priority} />
            <span className="text-xs capitalize text-muted">{item.type}</span>
            {item.status && <span className="text-xs text-muted">· {item.status.name}</span>}
            {item.assignee && <span className="text-xs text-muted">· Assigned to {item.assignee.name}</span>}
          </div>

          {item.description && <p className="text-sm text-strong whitespace-pre-wrap">{item.description}</p>}

          {item.acceptance_criteria && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Acceptance criteria</p>
              <p className="text-sm text-strong whitespace-pre-wrap">{item.acceptance_criteria}</p>
            </div>
          )}

          {item.labels && item.labels.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {item.labels.map((label) => (
                <span
                  key={label.id}
                  className="rounded-full px-2 py-0.5 text-xs font-medium text-white"
                  style={{ backgroundColor: label.color }}
                >
                  {label.name}
                </span>
              ))}
            </div>
          )}

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
                <SelectMenu value={linkType} onChange={setLinkType} options={ORBIT_LINK_TYPES} className="w-44" />
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
                  <p className="text-xs font-medium text-strong">{comment.author?.name}</p>
                  <p className="text-sm text-strong whitespace-pre-wrap">{comment.body}</p>
                </li>
              ))}
              {comments.length === 0 && <li className="text-sm text-muted">No comments yet.</li>}
            </ul>

            {canEdit && (
              <form onSubmit={handleComment} className="mt-3 flex flex-col gap-2">
                {commentError && <p className="text-sm text-danger">{commentError}</p>}
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
        </div>
      )}
    </Modal>
  );
}
