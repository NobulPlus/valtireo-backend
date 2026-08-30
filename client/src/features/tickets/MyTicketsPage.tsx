import { useState, type MouseEvent as ReactMouseEvent } from 'react';
import { Paperclip, Plus, X } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { SelectMenu } from '@/components/ui/SelectMenu';
import { Modal } from '@/components/ui/Modal';
import { ModalCancelAction, ModalConfirmAction, ModalSendAction } from '@/components/ui/ModalActions';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { PriorityBadge } from '@/components/ui/PriorityBadge';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useToast } from '@/components/ui/Toast';
import { useMyAssets } from '@/features/assets/api';
import {
  openTicketAttachmentInNewTab,
  slaStatus,
  useCancelTicket,
  useCreateTicket,
  useMyTickets,
  useTicketCategories,
  useTicketResolvers,
} from '@/features/tickets/api';
import { TicketDetailModal } from '@/features/tickets/TicketDetailModal';
import { useSetupLookups } from '@/features/workspace/api';
import { ApiError } from '@/lib/apiClient';
import { useDateFormatter } from '@/lib/dateFormat';
import type { Ticket } from '@/types/api';

function actionError(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

const ACTIVE_TICKET_STATUSES = new Set(['submitted', 'changes_requested', 'approved', 'in_progress', 'on_hold']);

function isActiveTicket(ticket: Ticket): boolean {
  return ACTIVE_TICKET_STATUSES.has(ticket.status);
}

function isCancellable(ticket: Ticket): boolean {
  return ticket.status === 'submitted' || ticket.status === 'changes_requested';
}

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

function CancelTicketButton({ ticket, onCancelled }: { ticket: Ticket; onCancelled: () => void }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const cancelMutation = useCancelTicket(ticket.id);

  async function handleCancel() {
    try {
      await cancelMutation.mutateAsync();
      setOpen(false);
      toast.success('Ticket cancelled');
      onCancelled();
    } catch (error) {
      toast.error('Could not cancel ticket', actionError(error, 'Could not cancel this ticket.'));
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={(event) => {
          event.stopPropagation();
          setOpen(true);
        }}
      >
        <X className="h-3.5 w-3.5" /> Cancel
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Cancel ticket"
        footer={
          <>
            <ModalCancelAction onClick={() => setOpen(false)} />
            <ModalConfirmAction title="Cancel ticket" variant="danger" isLoading={cancelMutation.isPending} onClick={handleCancel} />
          </>
        }
      >
        <p className="text-sm text-muted">This will cancel your ticket. This can't be undone.</p>
      </Modal>
    </>
  );
}

function MyTicketsContent() {
  const toast = useToast();
  const { formatDateTime } = useDateFormatter();
  const ticketsQuery = useMyTickets();
  const categoriesQuery = useTicketCategories({ is_active: true });
  const myAssetsQuery = useMyAssets();
  const resolversQuery = useTicketResolvers();
  const lookupsQuery = useSetupLookups();
  const createMutation = useCreateTicket();

  const [ticketModalOpen, setTicketModalOpen] = useState(false);
  const [form, setForm] = useState({
    ticket_category_id: '',
    subject: '',
    description: '',
    priority: 'medium',
    asset_id: '',
    assigned_to_user_id: '',
    department_id: '',
  });
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [viewingTicketId, setViewingTicketId] = useState<number | null>(null);

  async function handleViewAttachment(ticket: Ticket, event: ReactMouseEvent) {
    event.stopPropagation();
    try {
      await openTicketAttachmentInNewTab(ticket);
    } catch (error) {
      toast.error('Could not open attachment', actionError(error, 'Could not open this attachment.'));
    }
  }

  async function handleSubmitTicket() {
    if (!form.ticket_category_id || !form.subject.trim() || !form.description.trim()) return;
    try {
      await createMutation.mutateAsync({
        ticket_category_id: Number(form.ticket_category_id),
        subject: form.subject,
        description: form.description,
        priority: form.priority,
        asset_id: form.asset_id ? Number(form.asset_id) : undefined,
        assigned_to_user_id: form.assigned_to_user_id ? Number(form.assigned_to_user_id) : undefined,
        department_id: form.department_id ? Number(form.department_id) : undefined,
        attachment: attachmentFile,
      });
      setTicketModalOpen(false);
      setForm({
        ticket_category_id: '',
        subject: '',
        description: '',
        priority: 'medium',
        asset_id: '',
        assigned_to_user_id: '',
        department_id: '',
      });
      setAttachmentFile(null);
      toast.success('Ticket submitted', 'Your ticket has been submitted for review.');
    } catch (error) {
      toast.error('Could not submit ticket', actionError(error, 'Could not submit your ticket.'));
    }
  }

  const tickets = ticketsQuery.data?.data ?? [];
  const openTickets = tickets.filter(isActiveTicket);
  const history = tickets.filter((ticket) => !isActiveTicket(ticket));

  return (
    <div>
      <PageHeader
        title="My tickets"
        subtitle="Raise and track internal support requests."
        actions={
          <Button type="button" variant="primary" onClick={() => setTicketModalOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> New ticket
          </Button>
        }
      />

      <Card className="mb-5">
        <CardHeader>
          <CardTitle>Open</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {ticketsQuery.isLoading && <LoadingState label="Loading your tickets…" />}
          {ticketsQuery.isError && <ErrorState error={ticketsQuery.error} onRetry={() => ticketsQuery.refetch()} />}
          {ticketsQuery.data && openTickets.length === 0 && (
            <EmptyState title="No open tickets" description="Tickets you submit will appear here until they're resolved." />
          )}
          {openTickets.length > 0 && (
            <ul className="divide-y divide-border">
              {openTickets.map((ticket) => (
                <li
                  key={ticket.id}
                  onClick={() => setViewingTicketId(ticket.id)}
                  className="flex cursor-pointer items-center justify-between gap-4 px-5 py-3 text-sm hover:bg-surface-soft"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-strong">{ticket.subject}</p>
                    <p className="text-xs text-muted">
                      {ticket.category?.name ?? 'Uncategorized'} · {formatDateTime(ticket.submitted_at)}
                    </p>
                    {ticket.attachment_download_url && (
                      <button
                        type="button"
                        onClick={(event) => handleViewAttachment(ticket, event)}
                        className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-teal hover:underline"
                      >
                        <Paperclip className="h-3.5 w-3.5" />
                        {ticket.attachment_file_name ?? 'View attachment'}
                      </button>
                    )}
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-3">
                    {slaStatus(ticket) && (
                      <span className={`text-xs font-medium ${slaStatus(ticket)?.overdue ? 'text-danger' : 'text-muted'}`}>
                        {slaStatus(ticket)?.label}
                      </span>
                    )}
                    <PriorityBadge priority={ticket.priority} />
                    <StatusBadge status={ticket.status} />
                    {isCancellable(ticket) && (
                      <CancelTicketButton ticket={ticket} onCancelled={() => ticketsQuery.refetch()} />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>History</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {ticketsQuery.data && history.length === 0 && (
            <EmptyState title="No ticket history yet" description="Rejected or cancelled tickets will appear here." />
          )}
          {history.length > 0 && (
            <ul className="divide-y divide-border">
              {history.map((ticket) => (
                <li
                  key={ticket.id}
                  onClick={() => setViewingTicketId(ticket.id)}
                  className="flex cursor-pointer items-center justify-between gap-4 px-5 py-3 text-sm hover:bg-surface-soft"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-strong">{ticket.subject}</p>
                    <p className="text-xs text-muted">
                      {ticket.category?.name ?? 'Uncategorized'} · {formatDateTime(ticket.submitted_at)}
                    </p>
                    {ticket.attachment_download_url && (
                      <button
                        type="button"
                        onClick={(event) => handleViewAttachment(ticket, event)}
                        className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-teal hover:underline"
                      >
                        <Paperclip className="h-3.5 w-3.5" />
                        {ticket.attachment_file_name ?? 'View attachment'}
                      </button>
                    )}
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-3">
                    <PriorityBadge priority={ticket.priority} />
                    <StatusBadge status={ticket.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Modal
        open={ticketModalOpen}
        onClose={() => setTicketModalOpen(false)}
        title="New ticket"
        footer={
          <>
            <ModalCancelAction onClick={() => setTicketModalOpen(false)} />
            <ModalSendAction
              title="Submit ticket"
              isLoading={createMutation.isPending}
              disabled={!form.ticket_category_id || !form.subject.trim() || !form.description.trim()}
              onClick={handleSubmitTicket}
            />
          </>
        }
      >
        <div className="space-y-4">
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-muted">Category</span>
            <SelectMenu
              value={form.ticket_category_id}
              onChange={(value) => setForm((current) => ({ ...current, ticket_category_id: value }))}
              options={(categoriesQuery.data?.data ?? []).map((category) => ({ value: String(category.id), label: category.name }))}
              placeholder="Select a category"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-muted">Subject</span>
            <Input value={form.subject} onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-muted">Description</span>
            <Textarea
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              placeholder="Describe what you need help with."
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-muted">Priority</span>
            <SelectMenu
              value={form.priority}
              onChange={(value) => setForm((current) => ({ ...current, priority: value }))}
              options={PRIORITY_OPTIONS}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-muted">Send to a department (optional)</span>
            <SelectMenu
              value={form.department_id}
              onChange={(value) =>
                setForm((current) => {
                  const selectedResolver = (resolversQuery.data?.data ?? []).find((resolver) => String(resolver.id) === current.assigned_to_user_id);
                  const resolverStillMatches = value === '' || selectedResolver?.department?.id === Number(value);

                  return {
                    ...current,
                    department_id: value,
                    assigned_to_user_id: resolverStillMatches ? current.assigned_to_user_id : '',
                  };
                })
              }
              options={[{ value: '', label: 'No preference' }, ...(lookupsQuery.data?.departments ?? []).map((department) => ({ value: String(department.id), label: department.name }))]}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-muted">Send to a specific person (optional)</span>
            <SelectMenu
              value={form.assigned_to_user_id}
              onChange={(value) =>
                setForm((current) => {
                  const selectedResolver = (resolversQuery.data?.data ?? []).find((resolver) => String(resolver.id) === value);

                  return {
                    ...current,
                    assigned_to_user_id: value,
                    department_id: selectedResolver?.department ? String(selectedResolver.department.id) : current.department_id,
                  };
                })
              }
              options={[
                { value: '', label: 'No preference' },
                ...(resolversQuery.data?.data ?? [])
                  .filter((resolver) => !form.department_id || resolver.department?.id === Number(form.department_id))
                  .map((resolver) => ({ value: String(resolver.id), label: resolver.department ? `${resolver.name} (${resolver.department.name})` : resolver.name })),
              ]}
            />
          </label>
          {(myAssetsQuery.data?.data ?? []).length > 0 && (
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium text-muted">Related asset (optional)</span>
              <SelectMenu
                value={form.asset_id}
                onChange={(value) => setForm((current) => ({ ...current, asset_id: value }))}
                options={(myAssetsQuery.data?.data ?? []).map((asset) => ({ value: String(asset.id), label: `${asset.name} (${asset.asset_tag})` }))}
                placeholder="None"
              />
            </label>
          )}
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-muted">Attachment (optional)</span>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              onChange={(event) => setAttachmentFile(event.target.files?.[0] ?? null)}
              className="block w-full text-sm text-muted file:mr-3 file:rounded-md file:border file:border-border file:bg-surface file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-strong"
            />
            {attachmentFile && <span className="mt-1 block text-xs text-muted">{attachmentFile.name}</span>}
          </label>
        </div>
      </Modal>

      <TicketDetailModal ticketId={viewingTicketId} onClose={() => setViewingTicketId(null)} mode="view" />
    </div>
  );
}

export function MyTicketsPage() {
  return <MyTicketsContent />;
}
